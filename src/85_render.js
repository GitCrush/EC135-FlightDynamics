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
const FS_LIT=`${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uFog;uniform float uSpec;
void main(){vec3 n=normalize(vN);float d=max(dot(n,uSun),0.0);float amb=mix(0.30,0.52,clamp(-n.z*0.5+0.5,0.0,1.0));
  vec3 c=vC*(amb+0.62*d);
  if(uSpec>0.0){vec3 v=normalize(uCam-vW);float sp=pow(max(dot(reflect(-uSun,n),v),0.0),28.0);c+=vec3(1.0,0.97,0.9)*sp*uSpec*step(0.0,dot(n,uSun));}   // painted metal and glass catch the sun
  float dist=length(vW-uCam);float f=1.0-exp(-dist*0.00036);c=mix(c,uFog,f);gl_FragColor=vec4(c,uAlpha);}`;
/* Shadow: the aircraft's own meshes flattened onto the ground along the sun (planar projection) */
const FS_SHADOW=`${GLSL_PREC}uniform float uAlpha;void main(){gl_FragColor=vec4(0.02,0.03,0.02,uAlpha);}`;
/* The ground. Noise comes from one mipmapped, anisotropically filtered
   texture (R, G and B: smooth value noise with 16, 32 and 64 cells across
   the tile, A: one value per texel) fetched at four scales, so the GPU's
   filtering averages whatever is finer than a pixel; 2.2 computed some
   fifty hash values per pixel and point-sampled them at every distance,
   which was both the most expensive part of a frame and the shimmer.
   Stripes, lines and markings are drawn analytically and filtered by the
   pixel's footprint on the ground (screen-space derivatives,
   OES_standard_derivatives): thinner than a pixel, they fade to their
   average. The airfield and the roads are only evaluated inside their own
   bounds. */
const FS_GND=`#extension GL_OES_standard_derivatives : enable
${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uFog;uniform float uT;uniform vec4 uWash;uniform sampler2D uNoise;
${GLSL_COMMON}
float line(float d,float hw,float fw){return min(clamp((hw-d)/fw+0.5,0.0,1.0),2.0*hw/fw);}   // a line of half-width hw, d from its centre: coverage of the pixel
float fill(float d,float w){return clamp(0.5-d/w,0.0,1.0);}                               // inside a shape, d signed (negative inside)
float sq(float x,float fx){x=fract(x);fx=max(fx,1e-4);vec2 a=vec2(x-0.5*fx,x+0.5*fx);vec2 i=floor(a)*0.5+max(fract(a)-0.5,0.0);return (i.y-i.x)/fx;}   // step(0.5,fract(x)) averaged over the pixel
float tri(float x,float fx){return mix(0.5,1.0-2.0*abs(fract(x)-0.5),1.0-smoothstep(0.25,0.5,fx));}   // triangle wave, fading to its mean
#define ONCE for(int once_=0;once_<1;once_++)   // a one-pass loop around a block in a branch: software renderers (SwiftShader) then skip it where no pixel takes the branch; GPUs unroll it
void main(){
  vec2 p=vW.xy; float alt=-vW.z; vec3 n=normalize(vN);
  float dist=length(vW-uCam);
#ifdef GL_OES_standard_derivatives
  vec2 fwv=max(fwidth(p),vec2(1e-4));float fwa=max(fwidth(alt),1e-4);
#else
  vec2 fwv=vec2(max(dist*0.002,1e-4));float fwa=0.05;
#endif
  float fw=max(fwv.x,fwv.y);
  vec4 nB=texture2D(uNoise,p/4160.0+vec2(0.31,0.17));   // R 260 m, G 130 m, B 65 m cells
  vec4 nM=texture2D(uNoise,p/144.0+vec2(0.53,0.29));    // R 9 m, G 4.5 m, B 2.3 m, A 0.56 m
  vec4 nF=texture2D(uNoise,p/25.6+vec2(0.07,0.61));     // R 1.6 m, G 0.8 m, B 0.4 m, A 0.1 m
#ifndef LITE
  vec4 nX=texture2D(uNoise,p/9.86+vec2(0.83,0.41));     // R 0.62 m, G 0.31 m, B 0.15 m, A 3.9 cm
  vec4 nW=texture2D(uNoise,(p+uT*vec2(0.30,-0.22))/144.0+vec2(0.19,0.77));   // the lake's surface, drifting
#endif
  /* fields: 45 m cells, each with a crop type and a row direction */
  vec2 cell=floor(p/45.0), fc=fract(p/45.0);
  float r1=h(cell), r2=h(cell+3.7), r3=h(cell+11.1);
  vec3 fld;
  if(r1<0.55){
    vec3 grass=mix(vec3(0.33,0.46,0.20),vec3(0.47,0.55,0.25),nB.b);
    grass=mix(grass,vec3(0.30,0.40,0.17),0.4*(nM.r*0.6+nM.b*0.4));
#ifndef LITE
    // clumps (smooth: square cells looked like tiles from a low hover); a threshold of the noise, so it fades to its mean cover by hand
    float c1=mix(0.193,smoothstep(0.60,0.82,nF.g),1.0-smoothstep(0.2,0.48,fw)),c2=mix(0.106,smoothstep(0.68,0.90,nF.b),1.0-smoothstep(0.09,0.21,fw));
    grass=mix(grass,vec3(0.24,0.33,0.14),c1*0.40);
    grass=mix(grass,vec3(0.40,0.45,0.22),c2*0.32);
#endif
    fld=grass;
  }else{
    float rowc=(r2<0.5)?p.x:p.y,rowf=(r2<0.5)?fwv.x:fwv.y;
    if(r1<0.85)fld=mix(vec3(0.42,0.50,0.18),vec3(0.62,0.58,0.26),r3)*(0.86+0.14*tri(rowc/0.9,rowf/0.9))*(0.94+0.12*nM.g);   // 0.9 m rows
    else fld=vec3(0.36,0.28,0.18)*(0.80+0.20*tri(rowc/0.6,rowf/0.6))*(0.93+0.14*nF.r);                                    // ploughed, 0.6 m furrows
  }
  {vec2 e=min(fc,1.0-fc)*45.0;   // hedgerows along some cell edges, ~1.1 m wide
   float hx=step(0.35,h(cell+5.5))*line(e.x,0.56,max(fwv.x,0.5)),hy=step(0.35,h(cell+8.1))*line(e.y,0.56,max(fwv.y,0.5));
   fld=mix(fld,vec3(0.16,0.25,0.10)*(0.8+0.4*nM.a),max(hx,hy)*0.85);}
  /* forest floor (the same noise the trees were planted by) and rock */
  float fd=vn(p/260.0+vec2(9.2,4.4));
  fld=mix(fld,vec3(0.20,0.27,0.13),smoothstep(0.5,0.65,fd)*0.7);
  float slope=1.0-(-n.z);
  vec3 rock=mix(vec3(0.42,0.38,0.33),vec3(0.55,0.50,0.44),nM.g);
  fld=mix(fld,rock,smoothstep(0.045,0.09,slope));
  fld=mix(fld,vec3(0.55,0.47,0.33),clamp((alt-16.0)/12.0,0.0,1.0)*0.5);
  vec3 col=fld;float paved=0.0;
  /* roads, 7 m wide, with dashed centre lines */
  if(min(abs(p.y+300.0),abs(p.x-280.0))<4.5+fw)ONCE{
    float road=min(seg(p,vec2(-1500.0,-300.0),vec2(1500.0,-300.0)),seg(p,vec2(280.0,-1500.0),vec2(280.0,1500.0)));
    float k=fill(road-3.55,max(fw,0.5));
    col=mix(col,vec3(0.28,0.28,0.29)*(0.9+0.2*nF.r),k);
    float dash=sq(p.x/12.0,fwv.x/12.0)*line(abs(p.y+300.0),0.12,fwv.y)+sq(p.y/12.0,fwv.y/12.0)*line(abs(p.x-280.0),0.12,fwv.x);
    col=mix(col,vec3(0.9,0.9,0.85),min(dash,1.0)*fill(road-3.25,max(fw,0.5)));
    paved=k;}
  /* airfield: runway 18/36, taxiway, apron and pad, all in world metres */
  if(p.x>-915.0-fw&&p.x<45.0+fw&&p.y>-166.0-fw&&p.y<65.0+fw)ONCE{
    float rw=seg(p,vec2(-900.0,-150.0),vec2(-100.0,-150.0));
    float tw=min(seg(p,vec2(-100.0,-150.0),vec2(-40.0,-150.0)),seg(p,vec2(-40.0,-150.0),vec2(-40.0,-50.0)));
    float apron=max(abs(p.x)-40.0,abs(p.y)-60.0);
    vec3 asphalt=vec3(0.30,0.30,0.31)*(0.9+0.2*nF.r);
    vec3 concrete=vec3(0.58,0.57,0.54)*(0.92+0.12*nM.b);
#ifndef LITE
    float jt=max(line(abs(fract(p.x/5.0)-0.5)*5.0,0.025,max(fwv.x,0.05)),line(abs(fract(p.y/5.0)-0.5)*5.0,0.025,max(fwv.y,0.05)));
    concrete=mix(concrete,vec3(0.45,0.44,0.42),jt*0.5);   // slab joints
#endif
    float krw=fill(rw-10.1,max(fw,0.6));
    col=mix(col,asphalt,krw);
    float cl=line(abs(p.y+150.0),0.25,fwv.y)*sq(p.x/30.0,fwv.x/30.0)*step(-880.0,p.x)*step(p.x,-120.0);
    float thr=line(abs(p.y+150.0),8.0,fwv.y)*sq((p.y+150.0)/2.0,fwv.y/2.0)*(line(abs(p.x+890.0),6.0,fwv.x)+line(abs(p.x+110.0),6.0,fwv.x));
    float edge=line(abs(rw-9.6),0.2,fw);
    col=mix(col,vec3(0.92,0.92,0.88),min(cl+thr+edge,1.0)*krw);
    float ktw=fill(tw-5.05,max(fw,0.5));
    col=mix(col,concrete,ktw);
    float ty=line(seg(p,vec2(-100.0,-150.0),vec2(-40.0,-150.0)),0.12,fw)*sq(p.x/4.0,fwv.x/4.0)+line(abs(p.x+40.0),0.12,fwv.x)*step(-150.0,p.y)*step(p.y,-50.0)*sq(p.y/4.0,fwv.y/4.0);
    col=mix(col,vec3(0.95,0.80,0.15),min(ty,1.0));
    float kap=fill(apron,max(fw,0.6));
    col=mix(col,concrete,kap);
    float rp=length(p);
    col=mix(col,vec3(0.24,0.24,0.26),fill(rp-7.6,max(fw,0.4)));                         // pad
    col=mix(col,vec3(0.95,0.95,0.92),line(abs(rp-6.9),0.4,fw));                          // ring
    float Hm=line(abs(p.y),2.2,fwv.y)*line(abs(p.x),0.35,fwv.x)+line(abs(abs(p.y)-1.85),0.35,fwv.y)*line(abs(p.x),2.0,fwv.x);
    col=mix(col,vec3(0.95,0.95,0.92),min(Hm,1.0)*step(rp,7.0));
    float tl=line(abs(max(abs(p.x)-14.0,abs(p.y)-14.0)),0.2,fw)*sq((p.x+p.y)/3.0,(fwv.x+fwv.y)/3.0);
    col=mix(col,vec3(0.95,0.80,0.15),tl);
    paved=max(paved,max(max(krw,ktw),kap));}
  /* lake: the shore follows the terrain's height, antialiased like an edge */
  float dl=length(p-vec2(-450.0,550.0));
  float wet=dl<235.0?fill(alt+1.1,fwa):0.0;
  if(wet>0.0)ONCE{vec3 v=normalize(uCam-vW);
#ifdef LITE
    vec3 water=mix(vec3(0.16,0.30,0.38),vec3(0.28,0.42,0.48),nM.r);vec3 nn=vec3(0.0,0.0,-1.0);
#else
    vec3 water=mix(vec3(0.16,0.30,0.38),vec3(0.28,0.42,0.48),nW.r);
    vec3 nn=normalize(vec3((nW.g-0.5)*0.06,(nW.b-0.5)*0.06,-1.0));
#endif
    float spec=pow(max(dot(reflect(-uSun,nn),v),0.0),60.0);col=mix(col,water+spec*0.7,wet);}
  /* close to the eye: texture down to a few centimetres, the hover pilot's optic flow (the mip chain
     fades it where a pixel covers more) */
#ifdef LITE
  col*=1.0+(nF.a-0.5)*0.24;
#else
  col*=1.0+(nX.b-0.5)*0.20+(nX.g-0.5)*0.08+(nX.a-0.5)*0.16*(1.0-paved);
#endif
  /* rotor downwash: grass and crops flattened in rings travelling outward (lighter, the blades' undersides),
     ripples on water */
  float wd=length(p-uWash.xy);
  if(uWash.z>0.001&&wd<uWash.w*3.0)ONCE{float wk=uWash.z*exp(-wd/uWash.w)*smoothstep(0.5,2.5,wd);
    float rip=0.5+0.5*sin(wd*2.3-uT*13.0+vn(p*0.8+uT*0.4)*4.0);
    float veg=(1.0-paved)*(r1<0.85?1.0:0.35)*(1.0-wet);
    col=mix(col,col*1.30+vec3(0.05,0.06,0.02),wk*veg*0.6);col*=1.0+wk*veg*(rip-0.5)*0.55;   // flattened blades show their lighter undersides, in moving bands
    col+=vec3(0.30,0.33,0.34)*wk*pow(rip,3.0)*wet;}
  float d=max(dot(n,uSun),0.0);float amb=mix(0.34,0.54,clamp(-n.z*0.5+0.5,0.0,1.0));
  col=col*(amb+0.62*d);
  float f=1.0-exp(-dist*0.00036);col=mix(col,uFog,f);
  gl_FragColor=vec4(col,1.0);}`;
const VS_SKY=`attribute vec3 aP;uniform mat4 uMVP;varying vec3 vD;void main(){vD=aP;vec4 c=uMVP*vec4(aP,1.0);gl_Position=vec4(c.xy,c.w*0.9999,c.w);}`;   // just inside the far plane
/* Sky and clouds, drawn last, so only the pixels nothing else covers are
   shaded. The cloud field is the noise texture at two scales (four
   octaves in one fetch); its mip chain keeps the deck near the horizon,
   where a pixel spans kilometres of it, from crawling. */
const FS_SKY=`${GLSL_PREC}varying vec3 vD;uniform vec3 uSun;uniform vec3 uCam;uniform float uT;uniform vec3 uFog;uniform float uCloud;uniform vec2 uWind;uniform sampler2D uNoise;
void main(){vec3 d=normalize(vD);float up=clamp(-d.z,-0.05,1.0);
  vec3 zen=vec3(0.30,0.48,0.82),hor=uFog;
  vec3 c=mix(hor,zen,pow(max(up,0.0),0.45));
  float s=max(dot(d,uSun),0.0);c+=vec3(1.0,0.92,0.75)*(pow(s,600.0)*1.5+pow(s,12.0)*0.12);
  float hc=1500.0+uCam.z;vec2 uv=uCam.xy+d.xy/max(up,0.01)*hc-uWind*uT;   // cloud base 1500 m above sea level
  vec4 q=texture2D(uNoise,uv/13600.0);   // 850, 425, 212 and 53 m cells
  float k=dot(q,vec4(0.5,0.25,0.125,0.0625));float cov=smoothstep(0.55-uCloud*0.25,0.75-uCloud*0.2,k);
#ifdef LITE
  float shade=mix(0.70,1.0,smoothstep(0.55,0.85,k));   // light mode: shading from the same field
#else
  float shade=mix(0.68,1.0,dot(texture2D(uNoise,uv/4800.0+vec2(0.37,0.11)),vec4(0.5,0.25,0.125,0.0625)));
#endif
  vec3 cc=mix(vec3(0.62,0.66,0.72),vec3(1.0,1.0,1.0),shade);
  float fade=smoothstep(0.0,0.12,up);c=mix(c,cc,cov*fade*0.95);
  gl_FragColor=vec4(c,1.0);}`;
/* Textured, unlit (the instrument displays light themselves) */
const VS_TEX=`attribute vec3 aP;attribute vec2 aT;uniform mat4 uMVP;varying vec2 vT;void main(){vT=aT;gl_Position=uMVP*vec4(aP,1.0);}`;
const FS_TEX=`${GLSL_PREC}varying vec2 vT;uniform sampler2D uTex;uniform float uAlpha;void main(){vec4 c=texture2D(uTex,vT);gl_FragColor=vec4(c.rgb,c.a*uAlpha);}`;
function glProg(gl,vs,fs){const p=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}
  gl.linkProgram(p);const o={p,a:{},u:{}};for(const n of ['aP','aN','aC','aT'])o.a[n]=gl.getAttribLocation(p,n);for(const n of ['uMVP','uM','uSun','uCam','uAlpha','uFog','uT','uCloud','uWind','uTex','uSpec','uWash','uScale','uNoise','uTint'])o.u[n]=gl.getUniformLocation(p,n);return o;}
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
/* Graphics. The 3D view is drawn at the screen's own pixel density (sharp
   on high-density screens) within a pixel budget, always multisampled;
   the ground and sky shaders filter their patterns by the pixel's
   footprint, so what multisampling has left to do is edges.
   auto (default): full shaders; while frames come late the drawing
     resolution steps down (to 60 % at most) and climbs back when there is
     room again. Nothing else changes and nothing is remembered.
   full: full shaders at full resolution, whatever the frame rate.
   light, for weak GPUs: ground and sky with fewer noise octaves, a little
     over half of the forest trees, fewer downwash particles, the
     instrument panel redrawn at 15 Hz instead of 30, a third of the pixel
     budget, and the same dynamic resolution as auto.
   The physics, the shadow, the cockpit and every cue the trainer relies
   on are the same in all three. (2.1 and 2.2 dropped auto to light after
   a slow start and remembered it: no multisampling and 0.75 of the page's
   pixels, on a high-density screen under 40 % of the screen's resolution;
   that and the shimmer were the "aliasing everywhere".) */
const GFX={mode:'full',why:''};
const DRS={s:1,win:[],good:0,floor:0.6,cap:1,capT:0,check:null,t:0};
function gfxEffective(){return cfg.gfx==='light'||(cfg.gfx!=='full'&&R3.soft)?'light':'full';}
function gfxSet(choice){cfg.gfx=choice;try{localStorage.setItem('ec135fd.gfx',choice);localStorage.removeItem('ec135fd.gfxAuto');}catch(e){}
  GFX.mode=gfxEffective();drsReset();}
function drsReset(){Object.assign(DRS,{s:1,win:[],good:0,floor:0.6,cap:1,capT:0,check:null});GFX.why='';}
function gfxPixelRatio(W,H){   // drawing-buffer pixels per page pixel: the screen's density (at most 2) within the budget, times the dynamic scale
  const dpr=Math.min(2,typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1);
  const r=Math.min(dpr,Math.sqrt((R3.soft&&cfg.gfx!=='full'?0.5e6:GFX.mode==='light'?1.2e6:2.6e6)/Math.max(1,W*H)));
  return cfg.gfx==='full'?r:r*DRS.s;}
/* Dynamic resolution: frame intervals in windows of 45 frames against 60 per second. A late window steps
   the scale down by 0.1; if the next window is not faster the pixels were not the bottleneck (the CPU or
   the screen is), so the step is undone and taken as the floor. Four windows with room step it back up; a
   step up that has to be taken back caps the scale there for a minute. */
function drsStep(dt){
  DRS.t+=dt;if(cfg.gfx==='full'||!(dt>0)||dt>0.25||DRS.t<2)return;
  const w=DRS.win;w.push(dt);if(w.length<45)return;
  const mean=w.reduce((a,b)=>a+b,0)/w.length;w.length=0;const T=1/60;
  if(DRS.capT>0&&(DRS.capT-=45*mean)<=0)DRS.cap=1;
  if(DRS.check){const c=DRS.check;DRS.check=null;
    if(c.down&&mean>c.mean*0.94){DRS.floor=c.s;DRS.s=c.s;GFX.why=`resolution held at ${Math.round(DRS.s*100)} % (more pixels are not what it waits for)`;return;}
    if(!c.down&&mean>T*1.2){DRS.cap=DRS.s=c.s;DRS.capT=60;GFX.why=`resolution ${Math.round(DRS.s*100)} %`;return;}}
  if(mean>T*1.2&&DRS.s>DRS.floor+1e-6){DRS.check={down:true,s:DRS.s,mean};DRS.s=Math.max(DRS.floor,Math.round(DRS.s*10-1)/10);DRS.good=0;
    GFX.why=`resolution ${Math.round(DRS.s*100)} % (${(1/mean).toFixed(0)} fps)`;return;}
  if(mean<T*1.06){if(++DRS.good>=4&&DRS.s<DRS.cap-1e-6){DRS.check={down:false,s:DRS.s,mean};DRS.s=Math.min(DRS.cap,Math.round(DRS.s*10+1)/10);DRS.good=0;GFX.why=`resolution ${Math.round(DRS.s*100)} %`;}}
  else DRS.good=0;}
/* The noise texture: 256 x 256, tiling. R, G, B: smooth value noise (a
   smoothstep-interpolated random lattice, like vn() in the shaders) with
   16, 32 and 64 cells across; A: one random value per texel. Mipmapped,
   trilinear, and anisotropic where the GPU offers it (up to 8x), so
   ground seen at a grazing angle stays sharp without shimmering. */
function makeNoiseTex(gl){
  const N=256,data=new Uint8Array(N*N*4),rng=makeRng(20231),cells=[16,32,64];
  const lat=cells.map(c=>{const a=new Float32Array(c*c);for(let i=0;i<a.length;i++)a[i]=rng();return a;});
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const o=(y*N+x)*4;
    for(let k=0;k<3;k++){const c=cells[k],L=lat[k],fx=x*c/N,fy=y*c/N,i=Math.floor(fx),j=Math.floor(fy);let u=fx-i,v=fy-j;u=u*u*(3-2*u);v=v*v*(3-2*v);
      const g=(a,b)=>L[(b%c)*c+(a%c)];data[o+k]=Math.round(((g(i,j)*(1-u)+g(i+1,j)*u)*(1-v)+(g(i,j+1)*(1-u)+g(i+1,j+1)*u)*v)*255);}
    data[o+3]=Math.floor(rng()*256);}
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,N,N,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  const an=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  R3.aniso=an&&!R3.soft?Math.min(8,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;if(an)gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,R3.aniso);
  return t;}
function glInit(canvas){
  GFX.mode=gfxEffective();
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,stencil:true});
  if(!gl)throw new Error('WebGL not available');
  R3.deriv=!!gl.getExtension('OES_standard_derivatives');   // footprint filtering in the ground and sky shaders (enabled before they compile)
  R3.gl=gl;R3.canvas=canvas;R3.pr.lit=glProg(gl,VS_LIT,FS_LIT);R3.pr.gndFull=glProg(gl,VS_LIT,FS_GND);R3.pr.gndLite=glProg(gl,VS_LIT,'#define LITE\n'+FS_GND);
  R3.pr.skyFull=glProg(gl,VS_SKY,FS_SKY);R3.pr.skyLite=glProg(gl,VS_SKY,'#define LITE\n'+FS_SKY);R3.pr.tex=glProg(gl,VS_TEX,FS_TEX);R3.pr.shadow=glProg(gl,VS_LIT,FS_SHADOW);
  // what this GPU gives us; the far plane follows the depth buffer
  const hp=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  R3.info={deriv:R3.deriv,depthBits:gl.getParameter(gl.DEPTH_BITS),stencil:gl.getParameter(gl.STENCIL_BITS)>0,fragHighp:hp&&hp.precision>0,renderer:(gl.getExtension('WEBGL_debug_renderer_info')?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):'?')};
  R3.far=R3.info.depthBits>=24?9000:4500;
  // a software renderer (the browser's GPU switched off or blocklisted): auto picks light and a small pixel budget, no anisotropic filtering, and the side panel says so
  R3.soft=/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(String(R3.info.renderer));GFX.mode=gfxEffective();
  R3.noiseTex=makeNoiseTex(gl);R3.info.aniso=R3.aniso;
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
  buildScenery(gl);buildAircraft(gl);buildCockpit(gl);ngInit(gl);
}
function gfxLite(){return (GFX.mode=gfxEffective())==='light';}   // from the setting itself, so a change of cfg.gfx takes effect on the next frame
function buildScenery(gl){
  const b=new MB(),rng=makeRng(3);const hAt=(n,e)=>-terrainH(n,e);
  /* trees: placed here (same random stream as before), meshed per graphics mode in buildTrees */
  const TREES=[];const tree=(n,e,s,kind)=>{TREES.push({n,e,s,kind,dark:0.85+0.3*rng()});};
  // forests from the shared density function, jittered grid, 20 m spacing within 1300 m
  let nT=0;
  for(let n=-1300;n<=1300;n+=20)for(let e=-1300;e<=1300;e+=20){const jn=n+(rng()-0.5)*14,je=e+(rng()-0.5)*14;const d=forestD(jn,je);
    if(d<0.53||inLake(jn,je))continue;if(Math.hypot(jn,je)<90)continue;if(Math.abs(je+150)<24&&jn<-90&&jn>-910)continue;if(Math.abs(je+300)<8||Math.abs(jn-280)<8)continue;
    if(rng()>0.75+(d-0.5)*1.5)continue;tree(jn,je,0.75+rng()*0.7,rng()<0.6?'pine':'broad');nT++;}
  // scattered single trees, hedgerow trees
  for(let i=0;i<220;i++){const n=(rng()*2-1)*1400,e=(rng()*2-1)*1400;if(Math.hypot(n,e)<120||inLake(n,e))continue;if(Math.abs(e+150)<30&&n<-80&&n>-920)continue;if(Math.abs(e+300)<10||Math.abs(n-280)<10)continue;tree(n,e,0.9+rng()*0.8,'broad');TREES[TREES.length-1].single=true;}
  for(let i=0;i<14;i++){const a=i/14*2*Math.PI;tree(260+28*Math.cos(a),-220+28*Math.sin(a),1.3,'broad');TREES[TREES.length-1].single=true;}   // confined area
  R3.treeList=TREES;
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
/* Trees, meshed in 400 m tiles with a bounding sphere each, so a tile
   outside the view is not drawn (in the cockpit three quarters of the
   forest are behind or beside the camera), and in two levels of detail:
   near (tiles within ~700 m of the camera) lumpy crowns that carry their
   own light and shade (darker underneath, lighter on top, an irregular
   outline) and conifers in three tiers; far a plain low ellipsoid or cone,
   where a crown is a few pixels across. (2.2's dark discs under the
   crowns, meant as shade, read as polygons on the grass and are gone.)
   The light graphics mode keeps a little over half of the forest trees, a
   bit larger, with fewer faces; the single trees and the confined area
   stay. */
function gCrown(r,sa,sb,amp,rng,col){   // ellipsoid with its poles up and down, the radius rippled by a few random-phase harmonics, flatter underneath
  const ph=[0,0,0,0,0].map(()=>rng()*6.283),G=[];
  for(let j=0;j<=sb;j++){const t=j/sb*Math.PI,st=Math.sin(t),ct=Math.cos(t),row=[];
    for(let i=0;i<=sa;i++){const a=(i%sa)/sa*2*Math.PI;const k=1+amp*st*(0.55*Math.sin(3*a+ph[0])*Math.sin(2*t+ph[1])+0.35*Math.sin(5*a+ph[2])*Math.sin(3*t+ph[3])+0.3*Math.sin(2*a+ph[4]));
      row.push([st*Math.cos(a)*r[0]*k,st*Math.sin(a)*r[1]*k,-ct*r[2]*k*(ct<0?0.7:1)]);}G.push(row);}
  const P=[],N=[],C=[],I=[];
  for(let j=0;j<=sb;j++)for(let i=0;i<=sa;i++){const p=G[j][i];let n;
    if(j===0)n=[0,0,-1];else if(j===sb)n=[0,0,1];
    else{n=vnorm(vcross(vsub(G[j+1][i],G[j-1][i]),vsub(G[j][(i+1)%sa],G[j][(i+sa-1)%sa])));if(vdot(n,p)<0)n=vscl(n,-1);}
    P.push(p[0],p[1],p[2]);N.push(n[0],n[1],n[2]);
    const sh=0.62+0.22*(0.5-0.5*n[2])+0.16*clamp(-p[2]/r[2],-1,1);C.push([col[0]*sh,col[1]*sh,col[2]*sh]);}
  for(let j=0;j<sb;j++)for(let i=0;i<sa;i++){const b=j*(sa+1)+i;I.push(b,b+1,b+sa+1,b+1,b+sa+2,b+sa+1);}
  return {P,N,C,I};}
function buildTrees(gl,lite){
  const tiles=new Map(),hAt=(n,e)=>-terrainH(n,e);
  const cone=(b,n,e,z,r,h,seg,col,rng)=>{const c=gCone(0,r,h,0.04,seg,false);   // along +x, which UPX turns upward (2.2's pine tiers pointed down)
    const C=[];for(let v=0;v<c.P.length/3;v++){const k=v%2===0?0.72:1.08;C.push([col[0]*k,col[1]*k,col[2]*k]);}
    b.add(c.P,c.N,C,c.I,{R:mmul(rotZ(rng()*6.28),UPX),T:[n,e,z]});};
  let idx=0;
  for(const t of R3.treeList){idx++;
    if(lite&&!t.single&&ngHash(t.n*3.7,t.e*1.9)>0.55)continue;
    const rng=makeRng(idx*7919+13),s=t.s*(lite&&!t.single?1.15:1),n=t.n,e=t.e,dark=t.dark,z=hAt(n,e);
    const key=Math.floor((n+1600)/400)*16+Math.floor((e+1600)/400);
    let tl=tiles.get(key);if(!tl){tl={b:new MB(),f:new MB(),n0:Math.floor((n+1600)/400)*400-1600,e0:Math.floor((e+1600)/400)*400-1600,zs:[]};tiles.set(key,tl);}
    const b=tl.b,f=tl.f;tl.zs.push(z);
    if(t.kind==='pine'){
      const col=[0.10*dark,0.27*dark,0.12*dark];
      tube(b,[n,e,z],[n,e,z-2.2*s],0.22*s,0.15*s,[0.30,0.22,0.14],lite?4:5);
      for(const [zz,r,hh] of lite?[[1.5,2.1,5.2],[4.0,1.4,3.8]]:[[1.4,2.2,4.4],[3.4,1.75,3.8],[5.5,1.2,3.2]])
        cone(b,n,e,z-zz*s,r*s*(0.9+0.2*rng()),hh*s,lite?6:8,col,rng);
      cone(f,n,e,z-1.4*s,2.1*s,8.0*s,5,col,rng);}
    else{
      const g=0.25*rng(),col=[(0.19+0.10*g)*dark,(0.40+0.02*g)*dark,(0.14-0.02*g)*dark];
      tube(b,[n,e,z],[n,e,z-2.6*s],0.27*s,0.17*s,[0.34,0.25,0.16],lite?4:6);
      const cr=gCrown([2.7*s,2.6*s,2.4*s],lite?9:13,lite?5:7,0.16,rng,col);b.add(cr.P,cr.N,cr.C,cr.I,{T:[n,e,z-4.6*s]});
      if(!lite){const a=rng()*6.28;for(const [dx,dz,k] of [[1.3,-1.0,0.62],[-1.1,-0.2,0.55]]){const l=gCrown([1.9*s*k/0.6,1.8*s*k/0.6,1.6*s*k/0.6],9,5,0.18,rng,col);
        b.add(l.P,l.N,l.C,l.I,{T:[n+dx*s*Math.cos(a),e+dx*s*Math.sin(a),z-(4.6-dz)*s]});}}
      const fc=gCrown([2.8*s,2.8*s,2.6*s],6,3,0,rng,col);f.add(fc.P,fc.N,fc.C,fc.I,{T:[n,e,z-4.8*s]});}}
  const out=[];for(const tl of tiles.values()){const zm=tl.zs.reduce((a,b)=>a+b,0)/tl.zs.length,zr=Math.max(...tl.zs.map(z=>Math.abs(z-zm)));
    out.push({c:[tl.n0+200,tl.e0+200,zm-8],r:Math.hypot(200,200)+zr+12,meshes:tl.b.upload(gl),far:tl.f.upload(gl)});}
  return out;}
/* frustum test against the view-projection matrix (planes from its rows) */
function frustumPlanes(m){const r=i=>[m[i],m[4+i],m[8+i],m[12+i]],P=[];const w=r(3);
  for(const i of [0,1,2])for(const sg of [1,-1]){const a=r(i),p=[w[0]+sg*a[0],w[1]+sg*a[1],w[2]+sg*a[2],w[3]+sg*a[3]];const l=Math.hypot(p[0],p[1],p[2]);P.push(p.map(v=>v/l));}return P;}
function sphereVisible(P,c,r){for(const p of P)if(p[0]*c[0]+p[1]*c[1]+p[2]*c[2]+p[3]<-r)return false;return true;}
/* Lofted body with superelliptic sections: [x, half-width, half-height,
   z-centre, exponent] (2 = ellipse, larger = boxier), normals from the
   surface itself, colour per vertex from colFn(x, angle, section). */
function gLoftS(secs,seg,colFn,sub){
  /* sections interpolated with a Catmull-Rom spline (sub steps between key sections), then each quad
     gets its own four vertices and one colour from its centre, so window edges stay crisp */
  sub=sub||1;const S=[];for(let j=0;j<secs.length-1;j++)for(let k=0;k<sub;k++){const t=k/sub,p0=secs[Math.max(0,j-1)],p1=secs[j],p2=secs[j+1],p3=secs[Math.min(secs.length-1,j+2)];
    S.push(p1.map((_,q)=>{const a=p0[q],b=p1[q],c=p2[q],d=p3[q];return 0.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}));}
  S.push(secs[secs.length-1]);
  const pt=(sx,a)=>{const [x,w,h,zc,e]=sx;const c=Math.cos(a),s=Math.sin(a),k=2/(e||2);return [x,Math.max(w,0.001)*Math.sign(c)*Math.pow(Math.abs(c),k),zc+Math.max(h,0.001)*Math.sign(s)*Math.pow(Math.abs(s),k)];};
  const nS=S.length,G=[],GN=[];
  for(let j=0;j<nS;j++){G.push([]);GN.push([]);for(let i=0;i<=seg;i++){const a=i/seg*2*Math.PI;const p=pt(S[j],a);G[j].push(p);
    const pa=pt(S[j],a+0.01),pb=pt(S[j],a-0.01),qa=pt(S[Math.min(nS-1,j+1)],a),qb=pt(S[Math.max(0,j-1)],a);
    let n=vnorm(vcross(vsub(qa,qb),vsub(pa,pb)));if(vdot(n,[0,p[1],p[2]-S[j][3]])<0)n=vscl(n,-1);GN[j].push(n);}}
  const P=[],N=[],cols=[],I=[];
  for(let j=0;j<nS-1;j++)for(let i=0;i<seg;i++){const am=(i+0.5)/seg*2*Math.PI,cm=pt([(S[j][0]+S[j+1][0])/2,(S[j][1]+S[j+1][1])/2,(S[j][2]+S[j+1][2])/2,(S[j][3]+S[j+1][3])/2,(S[j][4]+S[j+1][4])/2],am);
    const col=colFn?colFn(cm[0],am,j,cm):[0.9,0.9,0.9];const b=P.length/3;
    for(const [jj,ii] of [[j,i],[j+1,i],[j,i+1],[j+1,i+1]]){const p=G[jj][ii],n=GN[jj][ii];P.push(p[0],p[1],p[2]);N.push(n[0],n[1],n[2]);cols.push(col);}
    I.push(b,b+1,b+2,b+2,b+1,b+3);}
  return {P,N,I,cols};}
function buildAircraft(gl){
  /* EC135 exterior: rounded cabin with the big windshield and chin windows,
     the engine cowling on the roof, a tail boom rising to the Fenestron's
     shroud with the swept fin above it, the T-shaped horizontal stabiliser
     with end plates, bearingless rotor with swept blade tips. A generic
     white and blue scheme (no operator's livery). Dimensions from the
     published three-view: length 10.2 m, cabin width 1.56 m. */
  const white=[0.90,0.90,0.88],blue=[0.10,0.20,0.42],glass=[0.10,0.15,0.20],dark=[0.16,0.16,0.18],metal=[0.55,0.55,0.57],red=[0.75,0.10,0.08];
  const b=new MB();
  // cabin and boom as one loft: nose, windshield, cabin, rear clamshell doors, boom
  const secs=[[3.62,0.05,0.05,0.30,2],[3.50,0.34,0.30,0.28,2.2],[3.25,0.56,0.55,0.18,2.5],[2.85,0.72,0.82,0.02,2.8],[2.30,0.78,0.98,-0.12,3.2],[1.60,0.80,1.03,-0.18,3.4],
    [0.60,0.80,1.03,-0.18,3.4],[-0.40,0.79,1.00,-0.20,3.4],[-1.10,0.74,0.92,-0.24,3.2],[-1.70,0.58,0.72,-0.36,2.8],[-2.20,0.40,0.46,-0.52,2.4],[-2.80,0.33,0.36,-0.60,2.2],
    [-4.20,0.27,0.30,-0.68,2.2],[-5.50,0.22,0.26,-0.76,2.2],[-5.95,0.20,0.25,-0.80,2.2]];
  const colFn=(x,a,j,p)=>{const c=Math.cos(a),s=Math.sin(a);   // s < 0: upper half (z up is negative)
    // windshield: front, upper part; chin windows: front, lower part beside the centre
    if(x>2.25&&x<3.30&&s<0.05&&s>-0.92)return Math.abs(p[1])<0.035?white:glass;   // windshield with its centre post
    if(x>2.55&&x<3.35&&s>0.25&&s<0.75&&Math.abs(c)>0.25)return glass;
    // front door windows and the rear sliding-door windows
    if(x>0.85&&x<2.20&&s<0.15&&s>-0.80&&Math.abs(c)>0.55)return glass;
    if(x>0.70&&x<0.85&&s<0.5&&s>-0.9&&Math.abs(c)>0.5)return [0.60,0.60,0.60];   // door seam
    if(x>-0.95&&x<0.70&&s<0.05&&s>-0.70&&Math.abs(c)>0.62)return glass;
    // livery: blue belly band along cabin and boom
    if(s>0.55&&x>-2.2)return blue;if(x<=-2.2&&s>0.2)return blue;
    return white;};
  const lf=gLoftS(secs,40,colFn,4);b.add(lf.P,lf.N,lf.cols,lf.I);
  // engine cowling on the roof, with intakes and the two exhausts
  {const cw=gLoftS([[1.05,0.05,0.02,-1.16,2],[0.85,0.42,0.18,-1.24,2.6],[0.30,0.55,0.30,-1.32,3],[-1.00,0.55,0.32,-1.30,3],[-1.90,0.42,0.24,-1.18,2.6],[-2.45,0.20,0.10,-1.00,2.2],[-2.70,0.05,0.04,-0.92,2]],18,()=>white);
   b.add(cw.P,cw.N,cw.cols,cw.I);
   for(const y of [-0.50,0.50]){const it=gBox([0.55,y,-1.36],[0.28,0.06,0.10]);b.add(it.P,it.N,dark,it.I);
     const ex=gCone(-1.55,0.13,-2.05,0.12,10);b.add(ex.P,ex.N,[0.20,0.18,0.17],ex.I,{T:[0,y*0.95,-1.30]});}
   const mast=gCone(0,0.16,0.30,0.12,10);b.add(mast.P,mast.N,dark,mast.I,{R:UPX,T:[0,0,-1.55]});}
  // Fenestron shroud: a thick ring round the fan, flush with the fin
  {const cx=-6.10,cz=-0.85,ri=0.52,ro=0.80,ty=0.15,n=28,P=[],Nn=[],I=[];
   const ring=(r0,r1,y0,y1,nrm)=>{const base=P.length/3;for(let i=0;i<=n;i++){const a=i/n*2*Math.PI,c=Math.cos(a),s=Math.sin(a);P.push(cx+r0*c,y0,cz+r0*s,cx+r1*c,y1,cz+r1*s);const nn=nrm(c,s);Nn.push(...nn,...nn);}
     for(let i=0;i<n;i++){const k=base+i*2;I.push(k,k+2,k+1,k+1,k+2,k+3);}};
   ring(ri,ri,-ty,ty,(c,s)=>[-c,0,-s]);ring(ro,ro,ty,-ty,(c,s)=>[c,0,s]);ring(ro,ri,ty,ty,()=>[0,1,0]);ring(ri,ro,-ty,-ty,()=>[0,-1,0]);
   b.add(P,Nn,white,I);
   const stator=gBox([cx,0,cz],[0.03,0.02,0.50]);for(const a of [0,1.05,2.1]){b.add(stator.P,stator.N,dark,stator.I,{R:[Math.cos(a),0,Math.sin(a),0,1,0,-Math.sin(a),0,Math.cos(a)],T:[0,0,0]});}}
  // fin above the shroud, swept back, and the small ventral fin with the tail bumper
  {const fin=(pts,th,col)=>{const [a,bq,c,d]=pts;const P=[],Nn=[],I=[];for(const y of [th,-th]){const base=P.length/3;for(const q of [a,bq,c,d]){P.push(q[0],y,q[1]);Nn.push(0,Math.sign(y),0);}if(y>0)I.push(base,base+1,base+2,base,base+2,base+3);else I.push(base,base+2,base+1,base,base+3,base+2);}
     const quads=[[0,1],[1,2],[2,3],[3,0]];for(const [i,j] of quads){const base=P.length/3,p0=pts[i],p1=pts[j];const e=vnorm([p1[0]-p0[0],0,p1[1]-p0[1]]),n=[e[2],0,-e[0]];
       P.push(p0[0],th,p0[1],p1[0],th,p1[1],p1[0],-th,p1[1],p0[0],-th,p0[1]);for(let k=0;k<4;k++)Nn.push(n[0],0,n[2]);I.push(base,base+2,base+1,base,base+3,base+2);}
     b.add(P,Nn,col,I);};
   fin([[-5.55,-1.30],[-6.75,-1.30],[-7.05,-2.40],[-6.45,-2.40]],0.07,white);
   fin([[-6.05,-2.15],[-7.00,-2.15],[-7.05,-2.40],[-6.45,-2.40]],0.075,blue);
   fin([[-5.60,-0.45],[-6.40,-0.45],[-6.65,0.05],[-6.25,0.05]],0.06,white);}
  // horizontal stabiliser under the boom with its two end plates
  {const st=gBox([-4.90,0,-0.42],[0.27,1.30,0.03]);b.add(st.P,st.N,white,st.I);
   for(const y of [-1.31,1.31]){const ep=gBox([-4.92,y,-0.40],[0.32,0.03,0.30]);b.add(ep.P,ep.N,blue,ep.I);}}
  // skids: tubes with upturned front ends on two arched cross tubes
  for(const y of [-1.02,1.02]){tube(b,[-1.55,y,1.30],[1.45,y,1.30],0.045,0.045,metal,8);tube(b,[1.45,y,1.30],[1.95,y,1.05],0.045,0.04,metal,8);tube(b,[1.95,y,1.05],[2.05,y,0.90],0.04,0.035,metal,8);
    tube(b,[-1.55,y,1.30],[-1.70,y,1.24],0.045,0.04,metal,8);
    for(const x of [0.95,-0.95]){tube(b,[x,0.0,0.80],[x,y*0.80,0.92],0.042,0.042,metal,6);tube(b,[x,y*0.80,0.92],[x,y,1.30],0.042,0.042,metal,6);}
    const step=gBox([0.4,y*0.97,1.08],[0.20,0.05,0.012]);b.add(step.P,step.N,dark,step.I);}
  // lights: landing light under the nose, beacon on the cowling, position lights on the stabiliser
  {const ll=gBox([2.95,0.0,0.62],[0.10,0.10,0.04]);b.add(ll.P,ll.N,[1,1,0.9],ll.I);
   const bc=gEll([0.06,0.06,0.04],8,4);b.add(bc.P,bc.N,red,bc.I,{T:[-1.6,0,-1.38]});
   const pl=gEll([0.04,0.04,0.04],6,4);b.add(pl.P,pl.N,[0.9,0.1,0.1],pl.I,{T:[-4.9,-1.35,-0.42]});b.add(pl.P,pl.N,[0.1,0.9,0.2],pl.I,{T:[-4.9,1.35,-0.42]});}
  R3.m.body=b.upload(gl)[0];
  // Fenestron fan: hub and blade blur inside the shroud
  const fb=new MB();const hubc=gCone(-0.12,0.13,0.12,0.13,10);fb.add(hubc.P,hubc.N,dark,hubc.I,{R:[0,1,0,-1,0,0,0,0,1],T:[-6.10,0,-0.85]});R3.m.fen=fb.upload(gl)[0];
  const fz=new MB();const fzd=gDisc(0.14,0.51,28);fz.add(fzd.P,fzd.N,[0.3,0.3,0.32],fzd.I,{R:rotX(-Math.PI/2),T:[-6.10,0.0,-0.85]});fz.add(fzd.P,fzd.N,[0.3,0.3,0.32],fzd.I,{R:rotX(Math.PI/2),T:[-6.10,0.0,-0.85]});R3.m.fenBlur=fz.upload(gl)[0];
  // main rotor blade: root cuff, constant chord, swept and tapered tip; the hub with its cap
  const bl=new MB();
  {const P=[],Nn=[],I=[];const prof=[[0.62,0.10,0.20],[0.95,0.145,0.145],[4.70,0.145,0.145],[4.95,0.10,0.18],[5.10,0.04,0.20]];   // [r, chord/2, aft offset of the chord centre]
   const th=0.018;for(let k=0;k<prof.length-1;k++){const [r0,c0,o0]=prof[k],[r1,c1,o1]=prof[k+1];
     for(const z of [-th,th]){const base=P.length/3;P.push(r0,o0-c0,z, r1,o1-c1,z, r1,o1+c1,z, r0,o0+c0,z);for(let q=0;q<4;q++)Nn.push(0,0,Math.sign(z));I.push(base,base+1,base+2,base,base+2,base+3,base,base+2,base+1,base,base+3,base+2);}}   // both windings: thin plates seen from either side
   bl.add(P,Nn,[0.20,0.20,0.22],I);
   const tipm=gBox([5.0,0.12,0],[0.09,0.08,0.021]);bl.add(tipm.P,tipm.N,[0.92,0.86,0.25],tipm.I);
   const cuff=gBox([0.55,0,0],[0.32,0.10,0.06]);bl.add(cuff.P,cuff.N,dark,cuff.I);}
  R3.m.blade=bl.upload(gl)[0];
  const hb=new MB();const hub=gCone(-0.10,0.32,0.10,0.30,12);hb.add(hub.P,hub.N,dark,hub.I,{R:UPX});const cap=gEll([0.20,0.20,0.16],10,6);hb.add(cap.P,cap.N,[0.30,0.30,0.32],cap.I,{T:[0,0,-0.18]});R3.m.hub=hb.upload(gl)[0];
  const db=new MB();const dd=gDisc(0.4,5.1,40);db.add(dd.P,dd.N,[0.6,0.6,0.62],dd.I);R3.m.disc=db.upload(gl)[0];
  const sb=new MB();const sd=gDisc(0,5.2,32);sb.add(sd.P,sd.N,[0.05,0.05,0.05],sd.I);R3.m.shadow=sb.upload(gl)[0];
  const cb=new MB();const cc=gCone(0,2.2,9,2.2,16,false);cb.add(cc.P,cc.N,[1.0,0.72,0.1],cc.I);R3.m.column=cb.upload(gl)[0];   // tutor target
  const rb=new MB();const rg=gDisc(4.2,8.5,40);rb.add(rg.P,rg.N,[0.72,0.68,0.5],rg.I);R3.m.wash=rb.upload(gl)[0];         // downwash ring
  const ph=new MB();const pl=gLoft([[3.4,0.06,0.06,0.2],[2.4,0.7,0.8,0.0],[0.8,0.8,0.9,-0.15],[-1.2,0.6,0.65,-0.25],[-2,0.4,0.4,-0.3],[-6.3,0.15,0.2,-0.4]],10);ph.add(pl.P,pl.N,[0.4,0.7,0.9],pl.I);R3.m.phantom=ph.upload(gl)[0];
}
/* ---- cockpit (drawn only in the cockpit view, in its own pass) ----
   The EC135's right-seat cockpit in body axes (x forward, y right, z down,
   metres from the CG; the eye sits at H.pilot.eye). The frame is what a
   pilot judges attitude against: the glareshield line, the windshield
   centre post and the door posts. Below the panel the lower windshield and
   the chin windows show the ground right at the skids, the hover pilot's
   most used view. The instruments are a live texture. Dimensions are
   estimates from photographs (cabin width ~1.5 m, low glareshield). */
function buildCockpit(gl){
  const frame=[0.40,0.41,0.44],trim=[0.50,0.51,0.53],shield=[0.15,0.15,0.16],seat=[0.17,0.19,0.24],cons=[0.20,0.20,0.22];   // (2.6: lighter, the frame read as black bars)
  const b=new MB();
  const post=(pts,r,col)=>{for(let i=0;i<pts.length-1;i++)tube(b,pts[i],pts[i+1],r,r,col||frame,8);};
  for(const sy of [-1,1]){
    post([[2.50,0.78*sy,0.40],[2.48,0.80*sy,0.02],[2.18,0.84*sy,-0.62],[1.66,0.80*sy,-1.12]],0.018);   // A-pillar along the windshield edge, down behind the panel (2.6: 3.6 cm, was 7)
    post([[0.72,0.82*sy,-1.14],[0.72,0.84*sy,0.48]],0.045);                                       // door post behind the front doors
    post([[0.72,0.84*sy,0.50],[2.42,0.82*sy,0.52]],0.035,trim);                                   // door sill
    post([[0.72,0.84*sy,-1.14],[1.66,0.80*sy,-1.12]],0.03);                                       // roof rail
    {const d=gBox([1.58,0.835*sy,0.36],[0.84,0.012,0.15]);b.add(d.P,d.N,trim,d.I);}                // lower door panel (the window above it)
  }
  post([[2.60,0,0.40],[2.56,0,0.07],[2.22,0,-0.68],[1.82,0,-1.16]],0.014);                         // windshield centre post
  post([[1.66,-0.80,-1.12],[1.82,0,-1.17],[1.66,0.80,-1.12]],0.018);                              // windshield top bow
  // roof with the overhead windows above the seats (tinted green, drawn as glass)
  for(const [x0,x1,y0,y1] of [[0.62,1.68,-0.14,0.14],[0.62,0.95,-0.82,0.82],[0.62,1.68,0.72,0.84],[0.62,1.68,-0.84,-0.72]]){
    const r=gBox([(x0+x1)/2,(y0+y1)/2,-1.20],[(x1-x0)/2,(y1-y0)/2,0.025]);b.add(r.P,r.N,trim,r.I);}
  // glareshield and the panel housing; the panel face itself is the textured quad
  // (the glareshield, its lip and the panel housing were boxes here until 2.5: seen from the eye a black table; the flat panel of the HUD is the panel since 2.6)
  // centre pedestal with its switch panel, floor around the chin windows
  {const ped=gBox([1.88,0,0.40],[0.33,0.16,0.22]);b.add(ped.P,ped.N,cons,ped.I);
   const top=gBox([1.88,0,0.175],[0.30,0.14,0.005]);b.add(top.P,top.N,[0.20,0.20,0.21],top.I);
   for(const [x0,x1,y0,y1] of [[0.62,2.08,-0.82,0.82],[2.08,2.70,-0.26,0.26],[2.08,2.70,0.76,0.84],[2.08,2.70,-0.84,-0.76],[2.62,2.70,-0.84,0.84]]){
     const f=gBox([(x0+x1)/2,(y0+y1)/2,0.64],[(x1-x0)/2,(y1-y0)/2,0.02]);b.add(f.P,f.N,[0.17,0.17,0.18],f.I);}}
  // left seat (the copilot's, empty) and the pilot's seat edge
  for(const y of [-0.50]){const sp=gBox([1.32,y,0.40],[0.24,0.22,0.05]);b.add(sp.P,sp.N,seat,sp.I);
    const bk=gBox([0,0,-0.32],[0.05,0.22,0.34]);b.add(bk.P,bk.N,seat,bk.I,{R:rotY(-0.25),T:[1.02,y,0.36]});}
  R3.m.cockpit=b.upload(gl);
  // glass: the overhead windows' green tint
  {const g=new MB();for(const sy of [-1,1]){const d=gBox([1.28,0.43*sy,-1.195],[0.33,0.29,0.004]);g.add(d.P,d.N,[0.20,0.45,0.30],d.I);}R3.m.cockpitGlass=g.upload(gl)[0];}
  // (the stick and the collective lever were drawn until 2.2: from the eye they stood in the middle of the view and hid the chin window)
  {const c=new MB();const pd=gBox([0,0,0],[0.025,0.06,0.10]);c.add(pd.P,pd.N,[0.20,0.20,0.20],pd.I,{R:rotY(0.5)});R3.m.pedal=c.upload(gl)[0];}
  // the instrument panel face: a textured quad from the glareshield down, tilted back toward the pilot
  {const P=[2.11,-0.64,-0.06, 2.11,0.64,-0.06, 2.25,0.64,0.34, 2.25,-0.64,0.34],T=[0,0, 1,0, 1,1, 0,1],I=[0,2,1,0,3,2];
   const m={n:6};m.vp=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.STATIC_DRAW);
   m.vt=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.vt);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(T),gl.STATIC_DRAW);
   m.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(I),gl.STATIC_DRAW);
   R3.m.panel=m;R3.panelCv=typeof document!=='undefined'&&document.createElement?document.createElement('canvas'):null;
   if(R3.panelCv){R3.panelK=(typeof devicePixelRatio==='number'&&devicePixelRatio>=1.5&&!gfxLite())?2:1;R3.panelCv.width=1024*R3.panelK;R3.panelCv.height=320*R3.panelK;R3.panelSized=false;R3.panelTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,R3.panelTex);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);}}
}
/* The panel: two primary flight displays (attitude, speed and height
   tapes, heading), the engine display between them (FLI and rotor speed,
   the EC135's first limitation indicator) and the warning lights above.
   Drawn into a canvas each frame and uploaded as the panel's texture. */
function panelDraw(){
  const cv=R3.panelCv;if(!cv)return;const x=cv.getContext('2d'),W=1024,Hc=320;x.setTransform(R3.panelK||1,0,0,R3.panelK||1,0,0);
  const [phi,th,psi]=S.eul,ias=S.ias/KT,alt=S.alt/FT,vs=S.vs/FPM,hd=((psi*RAD)%360+360)%360;
  x.fillStyle='#1b1c1f';x.fillRect(0,0,W,Hc);
  // panel texture: subtle vertical gradient and screw heads
  const gr=x.createLinearGradient(0,0,0,Hc);gr.addColorStop(0,'rgba(255,255,255,0.05)');gr.addColorStop(1,'rgba(0,0,0,0.25)');x.fillStyle=gr;x.fillRect(0,0,W,Hc);
  const pfd=(cx)=>{const w=250,h=230,x0=cx-w/2,y0=58;x.fillStyle='#050608';x.fillRect(x0-8,y0-8,w+16,h+16);
    x.save();x.beginPath();x.rect(x0,y0,w,h);x.clip();
    // attitude: horizon moves with pitch (4 px per degree) and rolls
    const ax=cx,ay=y0+h*0.48;x.save();x.translate(ax,ay);x.rotate(-phi);x.translate(0,th*RAD*4);
    x.fillStyle='#2f78c4';x.fillRect(-400,-800,800,800);x.fillStyle='#7a4f24';x.fillRect(-400,0,800,800);
    x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.moveTo(-400,0);x.lineTo(400,0);x.stroke();
    x.lineWidth=1.5;x.font='12px Arial';x.fillStyle='#fff';x.textAlign='left';x.textBaseline='middle';
    for(let d=-30;d<=30;d+=5){if(!d)continue;const yy=-d*4,l=d%10===0?40:20;x.beginPath();x.moveTo(-l,yy);x.lineTo(l,yy);x.stroke();if(d%10===0)x.fillText(String(Math.abs(d)),l+4,yy);}
    x.restore();
    // aircraft symbol and roll scale
    x.strokeStyle='#ffd23f';x.lineWidth=4;x.beginPath();x.moveTo(ax-55,ay);x.lineTo(ax-18,ay);x.lineTo(ax-18,ay+8);x.moveTo(ax+55,ay);x.lineTo(ax+18,ay);x.lineTo(ax+18,ay+8);x.stroke();
    x.fillStyle='#ffd23f';x.fillRect(ax-3,ay-3,6,6);
    x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.arc(ax,ay,88,-Math.PI*0.5-0.8,-Math.PI*0.5+0.8);x.stroke();
    for(const d of [-45,-30,-20,-10,0,10,20,30,45]){const a=-Math.PI/2+d*DEG,r1=88,r2=d%30===0?100:95;x.beginPath();x.moveTo(ax+r1*Math.cos(a),ay+r1*Math.sin(a));x.lineTo(ax+r2*Math.cos(a),ay+r2*Math.sin(a));x.stroke();}
    {const a=-Math.PI/2-phi;x.fillStyle='#fff';x.beginPath();x.moveTo(ax+84*Math.cos(a),ay+84*Math.sin(a));x.lineTo(ax+74*Math.cos(a-0.06),ay+74*Math.sin(a-0.06));x.lineTo(ax+74*Math.cos(a+0.06),ay+74*Math.sin(a+0.06));x.fill();}
    // speed tape (left), height tape (right): dark strips with the value boxed
    const tape=(tx,val,step,fmt)=>{x.fillStyle='rgba(20,22,26,0.72)';x.fillRect(tx,y0,46,h);x.fillStyle='#fff';x.font='12px Arial';x.textAlign='center';
      for(let k=-3;k<=3;k++){const v=Math.round(val/step)*step+k*step,yy=ay-(v-val)/step*32;if(yy<y0+6||yy>y0+h-6)continue;x.fillText(fmt(v),tx+23,yy);}
      x.fillStyle='#000';x.fillRect(tx-2,ay-11,50,22);x.strokeStyle='#fff';x.lineWidth=1.5;x.strokeRect(tx-2,ay-11,50,22);x.fillStyle='#fff';x.font='bold 15px Arial';x.fillText(fmt(val),tx+23,ay+1);};
    tape(x0,Math.max(0,ias),10,v=>String(Math.max(0,Math.round(v))));tape(x0+w-46,alt,100,v=>String(Math.round(v)));
    // heading and vertical speed
    x.fillStyle='rgba(20,22,26,0.8)';x.fillRect(x0+46,y0+h-26,w-92,26);x.fillStyle='#fff';x.font='bold 15px Arial';x.textAlign='center';x.fillText(String(Math.round(hd)).padStart(3,'0')+'°',cx,y0+h-12);
    x.fillStyle=vs<-1500&&S.rot.vrs>0.3?'#ff4030':'#7ee07a';x.font='12px Arial';x.fillText((vs>=0?'↑':'↓')+Math.abs(Math.round(vs/10)*10),cx,y0+14);
    x.restore();};
  pfd(W*0.84);pfd(W*0.16);
  // engine display: FLI and rotor speed as dial pointers, engine state
  {const cx=W*0.5,y0=58,w=210,h=230;x.fillStyle='#050608';x.fillRect(cx-w/2-8,y0-8,w+16,h+16);x.fillStyle='#0a0c10';x.fillRect(cx-w/2,y0,w,h);
   const dial=(dx,dy,r,v,v0,v1,zones,label,txt)=>{x.lineWidth=6;for(const [a,b,c] of zones){x.strokeStyle=c;x.beginPath();x.arc(dx,dy,r,Math.PI*0.75+(a-v0)/(v1-v0)*Math.PI*1.5,Math.PI*0.75+(b-v0)/(v1-v0)*Math.PI*1.5);x.stroke();}
     const a=Math.PI*0.75+clamp((v-v0)/(v1-v0),0,1)*Math.PI*1.5;x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.moveTo(dx,dy);x.lineTo(dx+(r-4)*Math.cos(a),dy+(r-4)*Math.sin(a));x.stroke();
     x.fillStyle='#fff';x.font='bold 17px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,dx,dy+r*0.55);x.font='11px Arial';x.fillStyle='#aab';x.fillText(label,dx,dy+r*0.95);};
   dial(cx-50,y0+70,42,S.eng.fli,0,12.5,[[0,10,'#3fae49'],[10,11,'#e8c02a'],[11,12.5,'#d33']],'FLI',S.eng.fli.toFixed(1));
   dial(cx+50,y0+70,42,S.NR,60,115,[[60,85,'#d33'],[85,97,'#e8c02a'],[97,104,'#3fae49'],[104,106,'#e8c02a'],[106,115,'#d33']],'NR %',S.NR.toFixed(0));
   x.font='12px Arial';x.textAlign='left';x.fillStyle='#cfd';const P=(S.Pbar!==undefined?S.Pbar:S.Peng)/1e3;
   x.fillText('PWR '+Math.round(P)+' kW',cx-w/2+12,y0+150);x.fillText('ENG '+S.eng.e.map(e=>e.fail?'FAIL':e.on?'ON':'OFF').join(' / '),cx-w/2+12,y0+170);
   x.fillText('OAT '+Math.round(atmo(S.alt,cfg.dT).T-273.15)+' °C   GW '+Math.round(S.m)+' kg',cx-w/2+12,y0+190);
   x.fillText('FUEL '+Math.max(0,Math.round(560-S.fuelBurn))+' kg',cx-w/2+12,y0+210);}
  // warning panel: lights from the state the pilot must not miss
  const lights=[['ENG FAIL',S.eng.e.some(e=>e.fail||!e.on)&&S.rot.Om>5,'#ff3b1f'],['ROTOR RPM',S.NR<95||S.NR>106,'#ff3b1f'],['FLI LIMIT',S.eng.fli>10.95,'#ffb300'],['TAIL ROTOR',S.fen.failed||S.fen.stall>0.5,'#ffb300'],['VRS',S.rot.vrs>0.5,'#ffb300'],['XMSN',false,'#ff3b1f']];
  lights.forEach(([t,on,c],i)=>{const lx=W*0.5-3*104+i*104+4,ly=10;x.fillStyle=on?c:'#2a2b2e';x.fillRect(lx,ly,96,30);x.fillStyle=on?'#000':'#55575c';x.font='bold 12px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(t,lx+48,ly+15);});
  const gl=R3.gl;gl.bindTexture(gl.TEXTURE_2D,R3.panelTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  if(R3.panelSized)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,cv);else{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);R3.panelSized=true;}   // the storage once, then only its contents
}
/* The cockpit has its own near plane of 2 cm, so the frame 0.3-1.5 m from
   the eye is sharp without costing the scenery its depth precision (the
   scene's near plane is 1 m). With a 24-bit depth buffer it is drawn
   first, into the front 1 % of the depth range (the scene gets the rest),
   so the ground and the sky behind the panel and the frame are never
   shaded; with 16 bits it is drawn last over a cleared depth buffer, as
   before 2.3. The panel is redrawn at 30 Hz (15 in light mode). */
function cockpitVP(){const c=R3.cam;return m4mul(m4persp(c.fov,R3.w/R3.h,0.02,60),m4view(c.pos,c.f,c.u));}
function drawCockpit(){
  const gl=R3.gl,R=qmat(S.q);if(!R3.m.cockpit)return;
  const keep=R3.vp;R3.vp=cockpitVP();
  const M=m4model(R,S.pos);for(const m of R3.m.cockpit)drawMesh(R3.pr.lit,m,M);
  for(const [y,sg] of [[0.40,-1],[0.70,1]]){const d=0.07*S.ctl.ped*sg;drawMesh(R3.pr.lit,R3.m.pedal,m4model(R,vadd(S.pos,mrot(R,[2.22+d,y,0.52]))));}   // the pedals follow the pilot's feet
  if(R3.panelCv){if(R3.panelT===undefined||R3.time-R3.panelT>=0.75/(gfxLite()?15:30)||R3.time<R3.panelT){panelDraw();R3.panelT=R3.time;}
    if(cfg.panel3d){const pr=R3.pr.tex,m=R3.m.panel;gl.useProgram(pr.p);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.vt);gl.enableVertexAttribArray(pr.a.aT);gl.vertexAttribPointer(pr.a.aT,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.uniformMatrix4fv(pr.u.uMVP,false,m4mul(R3.vp,M));gl.uniform1f(pr.u.uAlpha,1);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,R3.panelTex);gl.uniform1i(pr.u.uTex,0);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);gl.enable(gl.CULL_FACE);
    gl.disableVertexAttribArray(pr.a.aT);}}   // the 3D panel face only on request (cfg.panel3d); its canvas feeds the flat panel
  R3.vp=keep;
}
function drawCockpitGlass(){   // the overhead windows' tint, transparent: after the scene
  const gl=R3.gl;if(!R3.m.cockpitGlass)return;const keep=R3.vp;R3.vp=cockpitVP();
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);drawMesh(R3.pr.lit,R3.m.cockpitGlass,m4model(qmat(S.q),S.pos),0.45);gl.depthMask(true);gl.disable(gl.BLEND);
  R3.vp=keep;}
/* ---- near the ground: rotor-wash particles ----
   The surface types come from the ground shader's own hash, replicated
   here, so dust rises off ploughed and cropped fields, spray off the lake
   and a little grit off the pad. (2.0 to 2.1 also grew grass tufts and
   stones in a patch that followed the aircraft; seen from the cockpit they
   popped up as little cones, 'mini trees', and were removed in 2.2.) */
const VS_PART=`attribute vec3 aP;attribute vec4 aC;uniform mat4 uMVP;uniform float uScale;varying vec4 vC;
void main(){vec4 c=uMVP*vec4(aP,1.0);gl_Position=c;gl_PointSize=clamp(aC.a*uScale/max(c.w,0.5),1.0,256.0);vC=aC;}`;
const FS_PART=`${GLSL_PREC}varying vec4 vC;uniform float uAlpha;void main(){vec2 q=gl_PointCoord-0.5;float r=dot(q,q)*4.0;if(r>1.0)discard;gl_FragColor=vec4(vC.rgb,(1.0-r)*uAlpha);}`;
const NG={parts:null,pBuf:null,cBuf:null,n:0};
/* the shader's hash in single precision, step by step: near the wrap (mod 4096) it amplifies rounding a
   few thousand times, so double precision would paint different fields than the GPU does */
function ngHash(x,y){const F=Math.fround,fr=v=>v-Math.floor(v);x=((x%4096)+4096)%4096;y=((y%4096)+4096)%4096;
  let a=F(fr(F(x*F(0.1031)))),b=F(fr(F(y*F(0.1030)))),c=F(fr(F(x*F(0.0973))));
  const dd=F(F(a*F(b+33.33))+F(b*F(c+33.33))+F(c*F(a+33.33)));a=F(a+dd);b=F(b+dd);c=F(c+dd);return fr(F(F(a+b)*c));}
function ngSurface(n,e){   // what the ground shader paints here: 'paved', 'water', 'grass', 'crop', 'plough'
  const seg=(px,py,ax,ay,bx,by)=>{const pax=px-ax,pay=py-ay,bax=bx-ax,bay=by-ay;const t=clamp((pax*bax+pay*bay)/(bax*bax+bay*bay),0,1);return Math.hypot(pax-bax*t,pay-bay*t);};
  if(seg(n,e,-900,-150,-100,-150)<10.5||seg(n,e,-100,-150,-40,-150)<5.5||seg(n,e,-40,-150,-40,-50)<5.5||(Math.abs(n)<40.5&&Math.abs(e)<60.5)||seg(n,e,-1500,-300,1500,-300)<4||seg(n,e,280,-1500,280,1500)<4)return 'paved';
  for(const b of BUILDINGS)if(Math.abs(n-b.n)<b.w+12&&Math.abs(e-b.e)<b.l+2)return 'paved';
  if(inLake(n,e))return 'water';
  const fd=ngVn(n/260+9.2,e/260+4.4);if(fd>0.58)return 'grass';   // forest floor
  const r1=ngHash(Math.floor(n/45),Math.floor(e/45));return r1<0.55?'grass':r1<0.85?'crop':'plough';}
function ngVn(x,y){const i=Math.floor(x),j=Math.floor(y);let fx=x-i,fy=y-j;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=ngHash(i,j),b=ngHash(i+1,j),c=ngHash(i,j+1),d=ngHash(i+1,j+1);return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
function ngInit(gl){R3.pr.part=glProg(gl,VS_PART,FS_PART);
  NG.parts=[];for(let i=0;i<500;i++)NG.parts.push({life:0});NG.pBuf=gl.createBuffer();NG.cBuf=gl.createBuffer();NG.rng=makeRng(11);}
/* Downwash at the ground: where the wake lands (under the hub, carried by
   the wind), how strong (thrust over weight, fading out by ~2.5 rotor
   diameters) and how wide. Shared by the ground ripples and
   particles. */
function ngWash(){const st=S.rot,R=qmat(S.q),hub=vadd(S.pos,mrot(R,H.rotor.hub));const hg=terrainH(hub[0],hub[1]),hh=-hub[2]-hg;
  const k=st.Om>20?clamp(st.T/(S.m*9.81),0,1.3)*clamp(1-hh/26,0,1):0;const drift=vscl([S.wind[0],S.wind[1],0],clamp(hh/10,0,1.5));
  return [hub[0]+drift[0],hub[1]+drift[1],k,H.rotor.R*(0.9+0.12*Math.max(hh,0))];}
function ngDraw(dt){const gl=R3.gl,w=R3.wash;if(!R3.pr.part)return;
  // particles: dust off dry fields, spray off water, a little grit on paved ground
  const rng=NG.rng,ps=NG.parts;const k=w[2];
  if(k>0.05&&!UI.paused&&!UI.freeze){const lite=gfxLite();let spawn=k*k*(dt*900)*(lite?0.4:1);
    for(let ip=0;ip<(lite?200:ps.length);ip++){const p=ps[ip];if(spawn<1&&rng()>spawn)break;if(p.life>0)continue;spawn--;
      const a=rng()*2*Math.PI,r=w[3]*(0.5+0.8*rng()),n=w[0]+Math.cos(a)*r,e=w[1]+Math.sin(a)*r;const sf=ngSurface(n,e);
      const col=sf==='water'?[0.92,0.95,0.97]:sf==='plough'?[0.55,0.45,0.33]:sf==='crop'?[0.62,0.58,0.42]:sf==='paved'?[0.70,0.70,0.68]:[0.50,0.52,0.38];
      const amt=sf==='water'?1:sf==='plough'?1:sf==='crop'?0.6:sf==='paved'?0.15:0.25;if(rng()>amt)continue;
      const v=(5+7*rng())*k;Object.assign(p,{pos:[n,e,-terrainH(n,e)-0.2],vel:[Math.cos(a)*v,Math.sin(a)*v,-(0.8+2.0*rng())*k],life:1.2+1.6*rng(),age:0,col,size:sf==='water'?0.5:0.7});}}
  let n=0;const P=[],C=[];
  for(const p of ps){if(p.life<=0)continue;if(!UI.paused&&!UI.freeze){p.age+=dt;if(p.age>p.life){p.life=0;continue;}const dr=Math.exp(-dt*1.2);p.vel=[p.vel[0]*dr+(R3.windXY?R3.windXY[0]:0)*dt*0.8,p.vel[1]*dr+(R3.windXY?R3.windXY[1]:0)*dt*0.8,p.vel[2]*dr+dt*0.6];p.pos=vadd(p.pos,vscl(p.vel,dt));
      const g=-terrainH(p.pos[0],p.pos[1]);if(p.pos[2]>g-0.05){p.pos[2]=g-0.05;p.vel[2]=-Math.abs(p.vel[2])*0.3;}}
    const f=p.age/p.life;P.push(...p.pos);C.push(p.col[0],p.col[1],p.col[2],p.size*(1+2.5*f));n++;p.alpha=(1-f)*Math.min(1,p.age*4);}
  if(n){const pr=R3.pr.part;gl.useProgram(pr.p);gl.bindBuffer(gl.ARRAY_BUFFER,NG.pBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,NG.cBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(C),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(pr.a.aC);gl.vertexAttribPointer(pr.a.aC,4,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(pr.u.uMVP,false,R3.vp);gl.uniform1f(pr.u.uScale,(R3.ph||R3.h)*0.9/Math.tan(R3.cam.fov/2)*0.5);gl.uniform1f(pr.u.uAlpha,0.22*Math.min(1,k*1.5));
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,n);gl.depthMask(true);gl.disable(gl.BLEND);}
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
  gl.uniform3fv(pr.u.uFog,R3.fog);if(pr.u.uSpec)gl.uniform1f(pr.u.uSpec,R3.spec||0);if(pr.u.uWash)gl.uniform4fv(pr.u.uWash,R3.wash||[0,0,0,1]);if(pr.u.uT)gl.uniform1f(pr.u.uT,R3.time);if(pr.u.uCloud)gl.uniform1f(pr.u.uCloud,cfg.cloud);if(pr.u.uWind)gl.uniform2fv(pr.u.uWind,R3.windXY||[0,0]);
  if(pr.u.uNoise){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,R3.noiseTex);gl.uniform1i(pr.u.uNoise,1);gl.activeTexture(gl.TEXTURE0);}
  gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0);}
/* ---- cameras ---- */
function cameraUpdate(dt){
  const c=R3.cam,R=qmat(S.q),[phi,th,psi]=S.eul;
  // head: the mouse sets a target, the camera follows with a 120 ms lag; on release both return forward
  const lk=DEV.look;if(!lk.on){lk.yawT=(lk.yawT||0)*Math.max(0,1-dt*6);lk.pitchT=(lk.pitchT||0)*Math.max(0,1-dt*6);}
  const kf=Math.min(1,dt/0.12);lk.yaw+=((lk.yawT||0)-lk.yaw)*kf;lk.pitch+=((lk.pitchT||0)-lk.pitch)*kf;
  if(cfg.view==='cockpit'){
    c.pos=vadd(S.pos,mrot(R,H.pilot.eye));
    // head yaw about the body vertical, then pitch; the line of sight looks down so that the bottom of the view sits ~36° below (the flight displays), see cockpitFov
    const fv=cockpitFov(R3.w/Math.max(1,R3.h));
    const cy=Math.cos(lk.yaw),sy=Math.sin(lk.yaw),el=fv.down-lk.pitch,ce=Math.cos(el),se=Math.sin(el);
    c.f=mrot(R,[ce*cy,ce*sy,se]);c.u=mrot(R,[se*cy,se*sy,-ce]);c.fov=fv.v;
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
  }else if(cfg.view==='orbit'&&c.orbit){   // fixed camera relative to the aircraft (screenshots): body-frame offset, looking at the CG
    c.pos=vadd(S.pos,mrot(qmat(S.q),c.orbit));c.f=vnorm(vsub(vadd(S.pos,c.orbitAt||[0,0,0]),c.pos));c.u=[0,0,-1];c.fov=(c.orbitFov||40)*DEG;
  }else{
    c.pos=[-70,55,-(terrainH(-70,55)+12.6)];const d=vsub(S.pos,c.pos);const dist=vlen(d);
    c.f=vnorm(d);c.u=[0,0,-1];c.fov=clamp(2*Math.atan(22/dist),8*DEG,60*DEG);
  }
}
/* The cockpit's field of view. A flat screen looked at from an arm's length
   spans 40-60 degrees; the wider the projection beyond that, the more the
   frame and the panel, a metre from the eye, stretch towards the edges. So
   both angles are bounded: the setting is the angle across (default 72°);
   the vertical angle stays between 46° and 62° (a narrow window sees less
   across instead of more up and down; a wide one up to 85° across), and
   the line of sight is lowered so that the bottom of the view sits ~36°
   below the horizontal, where the flight displays are. Until 2.2 the
   vertical angle was fixed at 64° (107° across in a 2.15:1 window); 2.3
   allowed up to 100° in either direction, which still stretched the frame
   in narrow and wide windows. Returns the vertical angle and the look-down
   angle. */
function cockpitFov(asp){const h0=clamp(cfg.fov||72,50,90)*DEG,vMax=62*DEG,vMin=46*DEG,hMax=85*DEG;
  let v=2*Math.atan(Math.tan(h0/2)/asp);
  if(v>vMax)v=vMax;
  else if(v<vMin){const h=Math.min(hMax,Math.max(h0,2*Math.atan(Math.tan(vMin/2)*asp)));v=2*Math.atan(Math.tan(h/2)/asp);}
  return {v,down:clamp(36*DEG-v/2,5*DEG,14*DEG)};}
function project(w){const v=R3.vp;const x=v[0]*w[0]+v[4]*w[1]+v[8]*w[2]+v[12],y=v[1]*w[0]+v[5]*w[1]+v[9]*w[2]+v[13],z=v[2]*w[0]+v[6]*w[1]+v[10]*w[2]+v[14],ww=v[3]*w[0]+v[7]*w[1]+v[11]*w[2]+v[15];
  if(ww<=0.01)return null;return [(x/ww*0.5+0.5)*R3.w,(0.5-y/ww*0.5)*R3.h];}
function render(dt){
  const gl=R3.gl,cv=R3.canvas;R3.time+=dt;
  drsStep(dt);
  const lite=gfxLite();
  const W=cv.clientWidth|0,Hh=cv.clientHeight|0,pxr=gfxPixelRatio(W,Hh),bw=Math.max(1,Math.round(W*pxr)),bh=Math.max(1,Math.round(Hh*pxr));if(cv.width!==bw||cv.height!==bh){cv.width=bw;cv.height=bh;}
  R3.w=W;R3.h=Hh;R3.ph=bh;R3.pxr=pxr;gl.viewport(0,0,bw,bh);   // R3.w/h: page pixels (the HUD projects into them); the drawing buffer has pxr times as many each way
  R3.pr.gnd=lite?R3.pr.gndLite:R3.pr.gndFull;R3.pr.sky=lite?R3.pr.skyLite:R3.pr.skyFull;
  cameraUpdate(dt);
  const c=R3.cam;R3.vp=m4mul(m4persp(c.fov,W/Hh,1.0,R3.far),m4view(c.pos,c.f,c.u));
  R3.sun=vnorm([0.45,-0.35,-0.82]);R3.fog=[0.74,0.80,0.88];R3.windXY=[S.wind[0],S.wind[1]];
  gl.clearColor(R3.fog[0],R3.fog[1],R3.fog[2],1);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  /* Nearest first, so the depth test turns hidden pixels away before they are shaded: the cockpit, the
     aircraft, buildings and trees, then the ground, then the sky into whatever is left. Then the shadow
     and everything transparent. (Until 2.2 the sky and the ground were shaded first, under everything.) */
  const cockpit=cfg.view==='cockpit'&&!!cfg.panel3d,early=cockpit&&R3.info&&R3.info.depthBits>=24;   // the 3D cockpit only on request (cfg.panel3d); since 2.6.1 the cockpit is the flat panel (89_panel.js)
  if(early){gl.depthRange(0,0.01);drawCockpit();gl.depthRange(0.01,1);}
  // the aircraft
  const R=qmat(S.q),rt=H.rotor,st=S.rot;
  R3.spec=0.55;drawMesh(R3.pr.lit,R3.m.body,m4model(R,S.pos));   // from the cockpit the cabin's own faces are back faces (culled): only skids, nose and tail show
  drawMesh(R3.pr.lit,R3.m.fen,m4model(R,S.pos));
  const hubW=vadd(S.pos,mrot(R,rt.hub)),Rh=mmul(R,rt.Rbh);
  drawMesh(R3.pr.lit,R3.m.hub,m4model(Rh,hubW));
  if(!(cfg.view==='cockpit'&&st.Om>15))for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;const a=Math.atan2(-rt.s*Math.sin(psi),-Math.cos(psi));   // from the seat a turning rotor is its blur (the disc below), not four blades caught at random
    drawMesh(R3.pr.lit,R3.m.blade,m4model(mmul(Rh,mmul(rotZ(a),rotY(st.beta[k]))),hubW));}
  R3.spec=0;
  // scenery: buildings, trees (near tiles in full detail), windsock, wind turbines
  for(const m of R3.m.scene)drawMesh(R3.pr.lit,m,M4I);
  {const k=lite?'treesLite':'treesFull';if(!R3.m[k])R3.m[k]=buildTrees(gl,lite);const P=frustumPlanes(R3.vp);let nd=0,nn=0;
   for(const t of R3.m[k])if(sphereVisible(P,t.c,t.r)){const near=Math.hypot(t.c[0]-c.pos[0],t.c[1]-c.pos[1])-283<700;for(const m of near?t.meshes:t.far)drawMesh(R3.pr.lit,m,M4I);nd++;if(near)nn++;}R3.tilesDrawn=nd;R3.tilesNear=nn;}
  {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.2?Math.atan2(w[1],w[0]):WIND.dir*DEG+Math.PI;const droop=lerp(65*DEG,3*DEG,clamp(ws/7,0,1));   // windsock: points downwind, droops when calm
    const Rm=mmul(rotZ(az),rotY(-droop));drawMesh(R3.pr.lit,R3.m.sock,m4model(Rm,[35,-45,-terrainH(35,-45)-7]));}
  {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.5?Math.atan2(-w[1],-w[0]):WIND.dir*DEG;R3.turb+=dt*clamp(ws/6,0.15,1)*1.3;   // wind turbines: face the wind, turn with it
    for(const [n,e] of R3.turbines){drawMesh(R3.pr.lit,R3.m.turbine,m4model(mmul(rotZ(az),rotX(R3.turb)),[n,e,-terrainH(n,e)-60]));}}
  // the ground, then the sky dome (centred on the camera, just inside the far plane) where nothing else is
  R3.wash=ngWash();
  drawMesh(R3.pr.gnd,R3.m.ground,M4I);
  gl.depthMask(false);gl.disable(gl.CULL_FACE);drawMesh(R3.pr.sky,R3.m.sky,m4model([1,0,0,0,1,0,0,0,1],c.pos));gl.depthMask(true);gl.enable(gl.CULL_FACE);
  /* Shadow: every aircraft mesh projected along the sun onto the ground plane under the aircraft.
     The stencil lets each pixel be darkened once, however many shadow triangles cover it (without
     a stencil buffer, depth-equal rejection does the same, less cleanly). */
  {const sun=R3.sun,zg=-terrainH(S.pos[0],S.pos[1])-0.03,kx=sun[0]/sun[2],ky=sun[1]/sun[2];
   const Sh=new Float32Array([1,0,0,0, 0,1,0,0, -kx,-ky,0,0, kx*zg,ky*zg,zg,1]);   // column-major: x' = x - kx (z - zg), y' = y - ky (z - zg), z' = zg
   const hAbove=-S.pos[2]-terrainH(S.pos[0],S.pos[1]),al=clamp(0.42-hAbove*0.0035,0.06,0.42);
   const stc=R3.info&&R3.info.stencil;
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-8);gl.disable(gl.CULL_FACE);
   if(stc){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,0xff);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);gl.depthMask(false);}else gl.depthFunc(gl.LESS);
   const shd=(m,Mm,a)=>drawMesh(R3.pr.shadow,m,m4mul(Sh,Mm),a);
   shd(R3.m.body,m4model(R,S.pos),al);shd(R3.m.hub,m4model(Rh,hubW),al);
   for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;const a=Math.atan2(-rt.s*Math.sin(psi),-Math.cos(psi));shd(R3.m.blade,m4model(mmul(Rh,mmul(rotZ(a),rotY(st.beta[k]))),hubW),al);}
   if(st.Om>15){if(stc)gl.stencilFunc(gl.EQUAL,0,0xff);shd(R3.m.disc,m4model(Rh,hubW),al*0.18*clamp((st.Om-15)/25,0,1));}   // the spinning disc dims the ground a little
   if(stc){gl.disable(gl.STENCIL_TEST);gl.depthMask(true);}
   gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);}
  ngDraw(dt);   // downwash particles (after the sky, which would otherwise paint over them)
  // rotor disc blur at the tip-path plane, Fenestron blur, the phantom, the tutor's target, the prediction
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  if(st.Om>15){let b0=0,bc=0,bs=0;for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;b0+=st.beta[k];bc+=st.beta[k]*Math.cos(psi);bs+=st.beta[k]*Math.sin(psi);}
    b0/=rt.N;bc*=2/rt.N;bs*=2/rt.N;
    // tip-path plane: up(x,y) = b0 - bc x - s bs y in hub axes -> rotY(-bc) then rotX(s bs)
    const Rt=mmul(rotY(-bc),rotX(rt.s*bs));
    drawMesh(R3.pr.lit,R3.m.disc,m4model(mmul(Rh,Rt),vadd(hubW,mrot(Rh,[0,0,-2.5*Math.sin(b0)]))),clamp((st.Om-15)/25,0,1)*0.22);
    drawMesh(R3.pr.lit,R3.m.fenBlur,m4model(R,S.pos),clamp((st.Om-15)/25,0,1)*0.35);}
  // (until 1.9 a pale ring stood for the downwash; ground ripples and particles show it now)
  if(UI.phantom&&UI.phantom.S){const P=UI.phantom.S;drawMesh(R3.pr.lit,R3.m.phantom,m4model(qmat(P.q),P.pos),0.45);}
  if(TUTOR.target){const [n,e]=TUTOR.target;const pulse=0.25+0.15*Math.sin(R3.time*3);drawMesh(R3.pr.lit,R3.m.column,m4model(UPX,[n,e,-terrainH(n,e)]),pulse);}
  if(cfg.predict&&PRED.res){predDisplay(dt);predGL();}   // the predicted path anchored in the world and eased, the ghost (87_predict.js)
  gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  if(early){gl.depthRange(0,0.01);drawCockpitGlass();}
  else if(cockpit){gl.clear(gl.DEPTH_BUFFER_BIT);drawCockpit();drawCockpitGlass();}
  gl.depthRange(0,1);
}
