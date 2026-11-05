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
const FS_LIT=`${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uFog;uniform float uSpec;uniform float uFogK;
uniform vec3 uSunC;uniform vec3 uAmbC;uniform float uCloud;uniform vec2 uWind;uniform float uT;uniform sampler2D uNoise;
float cloudShadow(vec2 p,float alt){vec2 uv=p+uSun.xy/max(-uSun.z,0.12)*(1500.0-alt)-uWind*uT;float k=dot(texture2D(uNoise,uv/13600.0),vec4(0.5,0.25,0.125,0.0625));return 1.0-0.6*smoothstep(0.55-uCloud*0.25,0.75-uCloud*0.2,k)*step(0.01,uCloud);}   // the sky's own cloud field, met along the sun's ray at the cloud base (1500 m), drifting with the wind
void main(){vec3 n=normalize(vN);float d=max(dot(n,uSun),0.0)*cloudShadow(vW.xy,-vW.z);float amb=mix(0.30,0.52,clamp(-n.z*0.5+0.5,0.0,1.0));
  vec3 c=vC*(amb*uAmbC+0.62*d*uSunC);
  if(uSpec>0.0){vec3 v=normalize(uCam-vW);float sp=pow(max(dot(reflect(-uSun,n),v),0.0),28.0);c+=uSunC*sp*uSpec*step(0.0,dot(n,uSun));}   // painted metal and glass catch the sun
  float dist=length(vW-uCam);float f=1.0-exp(-dist*uFogK);c=mix(c,uFog,f);gl_FragColor=vec4(c,uAlpha);}`;
/* Shadows of the scenery (2.11): the static meshes (buildings, the village, the farms, pylons) carry the ground's z
   under each vertex in aT.x (the mesh builder's wDefault; aT.y = 0 marks pieces without a shadow, the wires);
   each vertex goes down the sun's ray to that plane, then a little toward the eye (at most 2.5 m, along the line
   of sight, so nothing moves on the screen) so the coarse ground mesh does not swallow it. A mesh without the
   attribute (the turbines' rotors, the cars) gets the plane as a constant (pr.aTconst). The trees: the instanced
   shapes projected on the tangent plane at the foot (the ground's gradient, packed into aI2.w per 30 m cell),
   fading out between uBand.x and .y. All of it on the stencil with the aircraft's shadow: a pixel darkened once. */
const VS_SHD=`attribute vec3 aP;attribute vec2 aT;uniform mat4 uMVP;uniform mat4 uM;uniform vec3 uSun;uniform vec3 uCam;varying float vA;
void main(){vec4 w=uM*vec4(aP,1.0);vec3 p=w.xyz;if(aT.y<0.5){gl_Position=vec4(2.0,2.0,2.0,1.0);vA=0.0;return;}
  p-=uSun*((p.z-aT.x)/uSun.z);vec3 d=uCam-p;float l=length(d);p+=d*min(0.004,2.5/max(l,1.0));vA=1.0;gl_Position=uMVP*vec4(p,1.0);}`;
const VS_INST_SHD=`attribute vec3 aP;attribute vec4 aI0;attribute vec4 aI1;attribute vec4 aI2;uniform mat4 uMVP;uniform vec3 uSun;uniform vec3 uCam;uniform vec3 uEye;uniform vec2 uBand;uniform float uK;varying float vA;
void main(){vec2 cs=aI1.xy;float kz=abs(aI2.x),s=aI0.w*uK;vec3 F=aI0.xyz;float dd=length(F-uEye);
  float a=(1.0-smoothstep(uBand.x,uBand.y,dd))*step(0.0,aI2.x);if(a<0.01){gl_Position=vec4(2.0,2.0,2.0,1.0);vA=0.0;return;}
  vec3 p=vec3(cs.x*aP.x-cs.y*aP.y,cs.y*aP.x+cs.x*aP.y,aP.z*kz)*s+F;
  float w=aI2.w,ga=floor(w/4096.0),gb=w-ga*4096.0,gn=ga/4095.0*4.0-2.0,ge=gb/4095.0*4.0-2.0;   // the ground's gradient at the foot
  vec3 dv=p-F;float t=(F.z-p.z-gn*dv.x-ge*dv.y)/max(-uSun.z-gn*uSun.x-ge*uSun.y,0.15);
  p-=uSun*t;vec3 d=uCam-p;float l=length(d);p+=d*min(0.004,2.5/max(l,1.0));vA=a;gl_Position=uMVP*vec4(p,1.0);}`;
const FS_SHD=`${GLSL_PREC}varying float vA;uniform float uAlpha;void main(){gl_FragColor=vec4(0.02,0.03,0.02,uAlpha*vA);}`;
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
${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uFog;uniform float uT;uniform vec4 uWash;uniform sampler2D uNoise;uniform float uFogK;
uniform vec3 uSunC;uniform vec3 uAmbC;uniform float uCloud;uniform vec2 uWind;uniform sampler2D uShore;
${GLSL_COMMON}
float cloudShadow(vec2 p,float alt){vec2 uv=p+uSun.xy/max(-uSun.z,0.12)*(1500.0-alt)-uWind*uT;float k=dot(texture2D(uNoise,uv/13600.0),vec4(0.5,0.25,0.125,0.0625));return 1.0-0.6*smoothstep(0.55-uCloud*0.25,0.75-uCloud*0.2,k)*step(0.01,uCloud);}   // the sky's own cloud field, met along the sun's ray at the cloud base (1500 m), drifting with the wind

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
  vec4 nW=texture2D(uNoise,(p+uT*(vec2(0.30,-0.22)+uWind*0.08))/144.0+vec2(0.19,0.77));   // the lake's surface, drifting (with the wind)
#endif
  /* fields (2.10): 90 m cells, each left whole, halved or quartered by its hash, every piece with a crop of its
     own (meadow, green crop, ripe grain, stubble, maize, ploughed, fallow) and its row direction; hedgerows and
     farm tracks along some of the pieces' edges (decided per 45 m of edge, so both sides agree) */
  vec2 cell=floor(p/90.0), fc=fract(p/90.0);
  float sp=h(cell+1.9);vec2 ks=vec2(sp<0.3?1.0:sp<0.5?2.0:sp<0.7?1.0:2.0, sp<0.5?1.0:2.0);   // pieces across and along
  vec2 piece=cell*4.0+floor(fc*ks);
  float r1=h(piece+0.3), r2=h(piece+3.7), r3=h(piece+11.1);
  vec3 fld;
  if(r1<0.40){   // meadow
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
    if(r1<0.55)fld=mix(vec3(0.42,0.50,0.18),vec3(0.55,0.56,0.24),r3)*(0.86+0.14*tri(rowc/0.9,rowf/0.9))*(0.94+0.12*nM.g);   // a green crop, 0.9 m rows
    else if(r1<0.67)fld=mix(vec3(0.72,0.62,0.30),vec3(0.80,0.70,0.36),r3)*(0.90+0.10*tri(rowc/0.9,rowf/0.9))*(0.92+0.16*nM.g);   // ripe grain
    else if(r1<0.75)fld=vec3(0.70,0.64,0.44)*(0.92+0.08*tri(rowc/0.35,rowf/0.35))*(0.90+0.20*nM.b);   // stubble
    else if(r1<0.83)fld=mix(vec3(0.27,0.40,0.15),vec3(0.33,0.45,0.17),r3)*(0.78+0.22*tri(rowc/0.75,rowf/0.75))*(0.94+0.12*nM.g);   // maize, 0.75 m rows
    else if(r1<0.92)fld=vec3(0.36,0.28,0.18)*(0.80+0.20*tri(rowc/0.6,rowf/0.6))*(0.93+0.14*nF.r);   // ploughed, 0.6 m furrows
    else fld=mix(vec3(0.40,0.42,0.22),vec3(0.50,0.47,0.26),nM.r)*(0.90+0.2*nF.g);   // fallow, weedy
  }
  {vec2 q=p/45.0,li=floor(q+0.5),e=abs(fract(q+0.5)-0.5)*45.0;   // the 45 m lattice: a line is a piece's edge at a cell's boundary, or inside a cell split along it
   vec2 isEdge=max(1.0-step(0.25,fract(li*0.5)),step(1.5,ks));   // a cell's boundary (li even) or a split inside it
   float ex=h(vec2(li.x*2.0+0.5,floor(q.y))+5.5)*isEdge.x,ey=h(vec2(floor(q.x),li.y*2.0+0.5)+8.1)*isEdge.y;   // one hash per edge: a hedgerow (~1.1 m wide) above 0.6, a farm track (2.6 m) below 0.12
   float hx=step(0.6,ex),hy=step(0.6,ey),tx=step(0.001,ex)*(1.0-step(0.12,ex)),ty=step(0.001,ey)*(1.0-step(0.12,ey));
   float hg=max(hx*line(e.x,0.56,max(fwv.x,0.5)),hy*line(e.y,0.56,max(fwv.y,0.5))),tk=max(tx*line(e.x,1.3,max(fwv.x,0.5)),ty*line(e.y,1.3,max(fwv.y,0.5)));
   fld=mix(fld,vec3(0.58,0.50,0.36)*(0.9+0.2*nF.r),tk*0.8);
   fld=mix(fld,vec3(0.16,0.25,0.10)*(0.8+0.4*nM.a),hg*0.85);}
  /* no fields on the high or steep ground (2.9): pasture */
  float slope=1.0-(-n.z),wild=max(smoothstep(60.0,190.0,alt),smoothstep(0.03,0.07,slope));
  if(wild>0.0)fld=mix(fld,mix(vec3(0.33,0.45,0.21),vec3(0.46,0.53,0.27),nB.b*0.6+nM.g*0.4),wild);
  /* the land by height (2.9): dry grass on the hills, alpine meadows above 150 m, forest (the same noise the
     trees were planted by; up the mountains to the tree line at 480 m; none in the clearing), rock on the steep
     flanks and the high ridges, snow above some 700 m where it can lie */
  float fd=vC.x;   // the forests' density at the mesh's vertices (10_atmo.js forestD, none where no tree stands): the floor under the trees
  fld=mix(fld,vec3(0.55,0.47,0.33),clamp((alt-16.0)/12.0,0.0,1.0)*0.5*(1.0-smoothstep(150.0,320.0,alt)));
  if(alt>150.0)fld=mix(fld,mix(vec3(0.40,0.49,0.25),vec3(0.55,0.56,0.35),nB.g*0.7+nM.r*0.3),smoothstep(150.0,320.0,alt));
#ifndef LITE
  /* flowers (2.9): on the pasture and the meadows, in drifts; white and yellow, pink, and on the alpine meadows
     blue-violet; a dot of 12 to 18 cm in some 45 cm cells, fading into the tint they give the meadow from afar */
  {float fm=(r1<0.40?1.0:wild)*(1.0-smoothstep(0.10,0.18,slope))*smoothstep(0.40,0.66,nB.g*0.55+nM.r*0.45);
   vec3 mt=mix(vec3(0.96,0.90,0.58),vec3(0.82,0.74,0.86),smoothstep(150.0,320.0,alt)*0.5);   // their tint from afar (a pixel over 10 cm: no dots to draw)
   if(fm>0.01&&fw>=0.10)fld=mix(fld,mt,fm*0.055);
   else if(fm>0.01)ONCE{vec2 q=p/0.45,ci=floor(q);vec2 o=vec2(h(ci+vec2(2.3,9.7)),h(ci+vec2(7.9,1.3)))*0.5+0.25;
     float d=length(fract(q)-o)*0.45,rad=0.06+0.03*h(ci+vec2(5.5,3.3)),hc=h(ci+vec2(11.7,8.8)),al=smoothstep(150.0,320.0,alt);
     vec3 fc=hc<0.45?vec3(0.95,0.94,0.88):hc<0.78?vec3(0.98,0.82,0.18):mix(vec3(0.90,0.52,0.68),vec3(0.52,0.46,0.92),al);
     float cov=step(1.0-fm*0.65,h(ci+vec2(17.3,4.1)))*fill(d-rad,max(fw,0.004)),fz=smoothstep(0.03,0.10,fw);
     fld=mix(fld,mix(fc,mix(vec3(0.96,0.90,0.58),vec3(0.82,0.74,0.86),al*0.5),fz),mix(cov,fm*0.055,fz));}}
#endif
  float fr=smoothstep(1300.0,2300.0,dist);   // beyond the trees drawn (~2 km) the forest as one: darker, mottled
  fld=mix(fld,mix(vec3(0.20,0.27,0.13),mix(vec3(0.11,0.19,0.09),vec3(0.21,0.30,0.14),nM.r),fr),smoothstep(0.5,0.65,fd)*mix(0.7,0.95,fr));
  vec3 rock=mix(vec3(0.42,0.38,0.33),vec3(0.55,0.50,0.44),nM.g);
  float hiA=smoothstep(250.0,600.0,alt);   // grass holds on steeper ground low down (rock from 26° below 250 m, from 17° above 600 m)
  fld=mix(fld,rock,clamp(smoothstep(mix(0.10,0.045,hiA),mix(0.20,0.09,hiA),slope)+smoothstep(560.0,720.0,alt+(nB.b-0.5)*90.0)*0.7,0.0,1.0));
  if(alt>600.0)fld=mix(fld,vec3(0.90,0.93,0.97)*(0.92+0.1*nM.b),smoothstep(700.0,760.0,alt+(nB.r-0.5)*140.0)*(1.0-smoothstep(0.22,0.40,slope)));
  vec3 col=fld;float paved=0.0;
  /* roads, 7 m wide, with dashed centre lines */
  if(min(abs(p.y+300.0),abs(p.x-280.0))<4.5+fw)ONCE{
    float road=min(seg(p,vec2(-1500.0,-300.0),vec2(1500.0,-300.0)),seg(p,vec2(280.0,-1500.0),vec2(280.0,1500.0)));
    float k=fill(road-3.55,max(fw,0.5));
    col=mix(col,vec3(0.28,0.28,0.29)*(0.9+0.2*nF.r),k);
    float dash=sq(p.x/12.0,fwv.x/12.0)*line(abs(p.y+300.0),0.12,fwv.y)+sq(p.y/12.0,fwv.y/12.0)*line(abs(p.x-280.0),0.12,fwv.x);
    col=mix(col,vec3(0.9,0.9,0.85),min(dash,1.0)*fill(road-3.25,max(fw,0.5)));
    paved=k;}
  /* the road to the town, and the town: streets on a 64 m grid, pavements, yards (2.9) */
  {float tr=seg(p,vec2(-1500.0,-300.0),vec2(-2000.0,-1180.0));if(tr<4.5+fw)ONCE{float k=fill(tr-3.55,max(fw,0.5));col=mix(col,vec3(0.28,0.28,0.29)*(0.9+0.2*nF.r),k);paved=max(paved,k);}}
  if(p.x>-2640.0&&p.x<-1960.0&&p.y>-1840.0&&p.y<-1160.0)ONCE{
    vec2 sd=abs(mod(p-vec2(-2620.0,-1820.0)+32.0,64.0)-32.0);float st=min(sd.x,sd.y);
    vec3 tc=mix(vec3(0.50,0.50,0.47),vec3(0.35,0.44,0.24),smoothstep(0.45,0.62,nM.r))*(0.92+0.12*nF.r);
    tc=mix(tc,vec3(0.63,0.62,0.59)*(0.94+0.1*nM.b),fill(st-7.0,max(fw,0.4)));
    tc=mix(tc,vec3(0.27,0.27,0.28)*(0.9+0.2*nF.r),fill(st-5.0,max(fw,0.4)));
    float inT=fill(max(max(-2620.0-p.x,p.x+1980.0),max(-1820.0-p.y,p.y+1180.0)),max(fw,2.0));
    col=mix(col,tc,inT);paved=max(paved,inT);}
  /* the hospital's car park (2.11): asphalt with bays, east of the building */
  {vec2 q=p-vec2(-258.0,-378.0);if(abs(q.x)<24.0&&abs(q.y)<9.0)ONCE{float k=fill(max(abs(q.x)-22.0,abs(q.y)-7.5),max(fw,0.4));col=mix(col,vec3(0.30,0.30,0.31)*(0.9+0.2*nF.r),k);
    float bays=line(abs(fract((q.x+1.5)/3.0)-0.5)*3.0,0.06,fwv.x)*step(abs(q.y),6.0)*step(2.0,abs(q.y));col=mix(col,vec3(0.9,0.9,0.85),bays*k);paved=max(paved,k);}}
  /* the pad on the summit (2.9) */
  {float dk=length(p-vec2(2350.0,700.0));if(dk<11.0)ONCE{
    col=mix(col,vec3(0.56,0.55,0.52)*(0.92+0.12*nM.b),fill(dk-9.0,max(fw,0.3)));col=mix(col,vec3(0.95,0.95,0.92),line(abs(dk-8.2),0.3,fw));
    vec2 q=p-vec2(2350.0,700.0);float Hm=line(abs(q.y),2.2,fwv.y)*line(abs(q.x),0.35,fwv.x)+line(abs(abs(q.y)-1.85),0.35,fwv.y)*line(abs(q.x),2.0,fwv.x);
    col=mix(col,vec3(0.95,0.95,0.92),min(Hm,1.0)*step(dk,7.5));paved=max(paved,fill(dk-9.0,max(fw,0.3)));}}
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
  /* lake: the shore follows the terrain's height, antialiased like an edge (2.10: inside the lake's own bounds only; the river's plain near the inflow lies as low) */
  float dl=length(p-vec2(-450.0,550.0));
  float wet=0.0;if(dl<235.0)ONCE{float th=atan(p.y-550.0,p.x+450.0)/6.2832+0.5;float rl=texture2D(uShore,vec2(th,0.5)).r*255.0;   // (2.10) the shore the terrain follows (10_atmo.js groundH, the radius by bearing in a 1-D texture): outside it the low ground is the river's plain, not the lake
    wet=fill(alt+1.1,fwa)*(1.0-smoothstep(8.0,22.0,dl-rl));}
  if(wet>0.0)ONCE{vec3 v=normalize(uCam-vW);
#ifdef LITE
    vec3 water=mix(vec3(0.16,0.30,0.38),vec3(0.28,0.42,0.48),nM.r);vec3 nn=vec3(0.0,0.0,-1.0);
#else
    vec3 water=mix(vec3(0.16,0.30,0.38),vec3(0.28,0.42,0.48),nW.r);
    vec3 nn=normalize(vec3((nW.g-0.5)*0.06,(nW.b-0.5)*0.06,-1.0));
#endif
    water=mix(water,uFog*0.9,pow(1.0-max(-v.z,0.0),3.0)*0.5);   // the sky in it at a grazing look
    float spec=pow(max(dot(reflect(-uSun,nn),v),0.0),60.0);col=mix(col,water+spec*0.7*uSunC,wet);}
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
    float veg=(1.0-paved)*(r1<0.83||r1>0.92?1.0:0.35)*(1.0-wet);
    col=mix(col,col*1.30+vec3(0.05,0.06,0.02),wk*veg*0.6);col*=1.0+wk*veg*(rip-0.5)*0.55;   // flattened blades show their lighter undersides, in moving bands
    col+=vec3(0.30,0.33,0.34)*wk*pow(rip,3.0)*wet;}
  float d=max(dot(n,uSun),0.0)*cloudShadow(p,alt);float amb=mix(0.34,0.54,clamp(-n.z*0.5+0.5,0.0,1.0));
  col=col*(amb*uAmbC+0.62*d*uSunC);
  float f=1.0-exp(-dist*uFogK);col=mix(col,uFog,f);
  gl_FragColor=vec4(col,1.0);}`;
/* Rivers (2.9): a ribbon over the flood plain, drawn after the ground. Its vertices are moved 0.4 % of the
   way toward the eye (along the line of sight, so nothing moves on the screen), so the coarse ground mesh far
   away cannot cover it. aC carries the flow coordinates: metres along / 10 and the side (-1 .. 1). The surface
   drifts downstream, darkens to gravel at the banks, mirrors the sky at a grazing look. */
const VS_WATER=`attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;uniform mat4 uMVP;uniform vec3 uCam;varying vec3 vC;varying vec3 vW;
void main(){vW=aP;vC=aC;vec3 d=uCam-aP;float l=length(d);gl_Position=uMVP*vec4(aP+d*min(0.004,2.0/max(l,1.0)),1.0);}`;   // (2.10: at most 2 m, so from high up the ribbon stays on the plain)
const FS_WATER=`${GLSL_PREC}varying vec3 vC;varying vec3 vW;uniform vec3 uSun;uniform vec3 uCam;uniform vec3 uFog;uniform float uT;uniform float uFogK;uniform sampler2D uNoise;uniform vec3 uSunC;uniform vec3 uAmbC;
void main(){vec3 v=normalize(uCam-vW);float dist=length(vW-uCam);
  vec2 fl=vec2(vC.x-uT*0.16,vC.y*0.6);
  vec4 q=texture2D(uNoise,fl*vec2(0.06,0.5)+vec2(0.21,0.63)),q2=texture2D(uNoise,fl*vec2(0.35,1.6)+vec2(0.71,0.13));
  vec3 water=mix(vec3(0.13,0.25,0.30),vec3(0.27,0.40,0.43),q.r*0.6+q2.g*0.4);
  vec3 nn=normalize(vec3((q2.b-0.5)*0.12,(q2.g-0.5)*0.12,-1.0));
  float fres=pow(1.0-max(-v.z,0.0),3.0);water=mix(water,uFog*0.92,fres*0.55);
  water=mix(water,vec3(0.47,0.44,0.37),smoothstep(0.78,1.0,abs(vC.y))*0.7);
  water*=mix(uAmbC,uSunC,0.45);water+=pow(max(dot(reflect(-uSun,nn),v),0.0),60.0)*0.6*uSunC;
  float f=1.0-exp(-dist*uFogK);gl_FragColor=vec4(mix(water,uFog,f),1.0);}`;
/* The vegetation's vertex shader (2.9.2): one shape (a template at unit size) drawn many times, each instance
   with its place and size (aI0: north, east, down, scale) and its turn, horizontal stretch, brightness, rank
   and phase (aI1: cos and sin of the turn times the stretch, brightness, rank x 1000 + phase 0..1). Each
   vertex carries how much it may move (aT.x: 0 at the foot, 1 at the top): the crowns lean downwind and sway
   in gusts, and under a hovering rotor they are pushed away from the wake and shake.
   2.9.3, no popping: each instance decides for itself, by its own distance, whether this draw's shape (the
   band uBand of distances) is its own, and whether it is kept at all: a share keep(d) of the instances is
   kept (all near, fewer with distance: uKD the distances, uKV the shares between them and an overall
   factor), those of a rank below it; one about to be dropped shrinks away over 5 % of rank, the kept ones
   grow a little to fill the gaps (uCE). So nothing appears or changes at once, and never a whole tile. */
const VS_INST=`attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;attribute vec2 aT;attribute vec4 aI0;attribute vec4 aI1;attribute vec4 aI2;
uniform mat4 uMVP;uniform float uT;uniform vec2 uWind;uniform vec4 uWash;uniform float uK;uniform vec3 uEye;uniform vec2 uBand;uniform vec4 uKD;uniform vec3 uKV;uniform float uCE;uniform float uBW;
varying vec3 vN;varying vec3 vC;varying vec3 vW;varying float vA;
float keep(float d){float k=d<uKD.y?mix(1.0,uKV.x,smoothstep(uKD.x,uKD.y,d)):d<uKD.z?mix(uKV.x,uKV.y,smoothstep(uKD.y,uKD.z,d)):mix(uKV.y,0.0,smoothstep(uKD.z,uKD.w,d));return k*uKV.z;}
void main(){vec2 cs=aI1.xy;float k2=dot(cs,cs),rank=floor(aI1.w)*0.001,ph01=fract(aI1.w);
  float d=length(aI0.xyz-uEye),kp=keep(d);
  float bf=(uBand.x<=0.0?1.0:smoothstep(uBand.x-uBW,uBand.x+uBW,d))*(1.0-smoothstep(uBand.y-uBW,uBand.y+uBW,d));   // (2.12) this shape's share: cross-faded with the next over 2 uBW
  vA=clamp((kp-rank)/0.08,0.0,1.0)*bf;   // and whether the tree is kept at this distance: faded, not shrunk (alpha to coverage; 2.9.3 to 2.11 grew the trees out of the ground)
  float s=aI0.w*uK*pow(max(kp,0.05),-uCE)*step(0.001,vA),kz=abs(aI2.x);   // (2.10) each its own height to width (2.11: negative = no shadow)
  vec3 p=vec3(cs.x*aP.x-cs.y*aP.y,cs.y*aP.x+cs.x*aP.y,aP.z*kz)*s+aI0.xyz;
  float w=aT.x,ph=ph01*6.2832,ws=length(uWind);vec2 wd=ws>0.2?uWind/ws:vec2(0.0);
  float g=sin(uT*1.3+ph)*0.6+sin(uT*2.7+ph*1.7)*0.4;
  vec2 off=wd*w*(0.035*ws)*(0.75+0.45*g);
  vec2 dv=p.xy-uWash.xy;float dd=length(dv);float k=uWash.z*exp(-dd/max(uWash.w,1.0))*smoothstep(1.0,4.0,dd);
  off+=dv/max(dd,0.1)*k*w*(0.9+0.5*sin(uT*7.0+ph+dd*0.5));
  p.xy+=off*step(0.001,s);vW=p;vN=normalize(vec3(cs.x*aN.x-cs.y*aN.y,cs.y*aN.x+cs.x*aN.y,aN.z*k2/kz));
  float hue=aI2.y;vec3 c=aC*aI1.z*vec3(1.0+0.26*hue,1.0+0.04*abs(hue),1.0-0.22*hue);   // (2.10) each its own green, yellow to blue
  vC=mix(c,mix(vec3(0.84,0.82,0.76),vec3(0.42,0.33,0.22),fract(ph01*5.17)*0.5)*aI1.z,aT.y*aI2.z);   // a birch's white trunk (aT.y marks the trunk)
  gl_Position=uMVP*vec4(p,1.0);}`;
const VS_SKY=`attribute vec3 aP;uniform mat4 uMVP;varying vec3 vD;void main(){vD=aP;vec4 c=uMVP*vec4(aP,1.0);gl_Position=vec4(c.xy,c.w*0.9999,c.w);}`;   // just inside the far plane
/* Sky and clouds, drawn last, so only the pixels nothing else covers are
   shaded. The cloud field is the noise texture at two scales (four
   octaves in one fetch); its mip chain keeps the deck near the horizon,
   where a pixel spans kilometres of it, from crawling. */
const FS_SKY=`${GLSL_PREC}varying vec3 vD;uniform vec3 uSun;uniform vec3 uCam;uniform float uT;uniform vec3 uFog;uniform float uCloud;uniform vec2 uWind;uniform sampler2D uNoise;uniform vec3 uSunC;uniform vec3 uZen;
void main(){vec3 d=normalize(vD);float up=clamp(-d.z,-0.05,1.0);
  vec3 zen=uZen,hor=uFog;
  vec3 c=mix(hor,zen,pow(max(up,0.0),0.45));
  float s=max(dot(d,uSun),0.0);c+=uSunC*(pow(s,600.0)*1.5+pow(s,12.0)*0.12+pow(s,4.0)*0.10*(1.0-up));   // the sun, its glow, warmer low down
  float hc=1500.0+uCam.z;vec2 uv=uCam.xy+d.xy/max(up,0.01)*hc-uWind*uT;   // cloud base 1500 m above sea level
  vec4 q=texture2D(uNoise,uv/13600.0);   // 850, 425, 212 and 53 m cells
  float k=dot(q,vec4(0.5,0.25,0.125,0.0625));float cov=smoothstep(0.55-uCloud*0.25,0.75-uCloud*0.2,k);
#ifdef LITE
  float shade=mix(0.70,1.0,smoothstep(0.55,0.85,k));   // light mode: shading from the same field
#else
  float shade=mix(0.68,1.0,dot(texture2D(uNoise,uv/4800.0+vec2(0.37,0.11)),vec4(0.5,0.25,0.125,0.0625)));
#endif
  vec3 cc=mix(vec3(0.62,0.66,0.72)*mix(vec3(1.0),uSunC,0.35),uSunC*1.05,shade);cc=mix(cc,uFog,0.25*(1.0-dot(uSunC,vec3(0.333))));   // lit by the hour's sun
  float fade=smoothstep(0.0,0.12,up);
#ifndef LITE
  {vec2 uv2=(uCam.xy+d.xy/max(up,0.01)*(7000.0+uCam.z)-uWind*uT*2.5);float ci=texture2D(uNoise,vec2(uv2.x/70000.0,uv2.y/22000.0)+vec2(0.61,0.29)).g;   // (2.10) cirrus, high and thin, streaked along the wind
   c=mix(c,mix(uSunC,vec3(1.0),0.4)*0.98,smoothstep(0.52,0.78,ci)*0.45*(0.35+0.65*uCloud)*fade);}
#endif
  c=mix(c,cc,cov*fade*0.95);
  gl_FragColor=vec4(c,1.0);}`;
/* Textured, unlit (the instrument displays light themselves) */
const VS_TEX=`attribute vec3 aP;attribute vec2 aT;uniform mat4 uMVP;varying vec2 vT;void main(){vT=aT;gl_Position=uMVP*vec4(aP,1.0);}`;
const FS_TEX=`${GLSL_PREC}varying vec2 vT;uniform sampler2D uTex;uniform float uAlpha;void main(){vec4 c=texture2D(uTex,vT);gl_FragColor=vec4(c.rgb,c.a*uAlpha);}`;
function glProg(gl,vs,fs){const p=gl.createProgram();for(const [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}
  gl.linkProgram(p);const o={p,a:{},u:{}};for(const n of ['aP','aN','aC','aT','aI0','aI1','aI2'])o.a[n]=gl.getAttribLocation(p,n);for(const n of ['uMVP','uM','uSun','uCam','uAlpha','uFog','uT','uCloud','uWind','uTex','uSpec','uWash','uScale','uNoise','uTint','uFogK','uSunC','uAmbC','uZen','uK','uEye','uBand','uKD','uKV','uCE','uShore','uBW'])o.u[n]=gl.getUniformLocation(p,n);return o;}
/* ---- mesh builder: primitives appended with a transform, chunked at 60k vertices ---- */
function MB(){this.chunks=[];this.cur=null;this.fresh();}
MB.prototype.fresh=function(){this.cur={P:[],N:[],C:[],I:[],W:[]};this.chunks.push(this.cur);};
// (2.11) wDefault: a per-vertex attribute for every piece added, e.g. the ground's z under it, for the shadows
MB.prototype.add=function(pos,nrm,col,idx,M,Wf){Wf=Wf||this.wDefault;if(Wf)this.hasW=true;if(this.cur.P.length/3+pos.length/3>60000)this.fresh();const c=this.cur,b=c.P.length/3;const R=M&&M.R?M.R:null,T=M&&M.T?M.T:[0,0,0],S=M&&M.S?M.S:null;
  for(let i=0;i<pos.length;i+=3){let p=[pos[i],pos[i+1],pos[i+2]],n=[nrm[i],nrm[i+1],nrm[i+2]];if(S){p=[p[0]*S[0],p[1]*S[1],p[2]*S[2]];n=vnorm([n[0]/S[0],n[1]/S[1],n[2]/S[2]]);}if(R){p=mrot(R,p);n=mrot(R,n);}c.P.push(p[0]+T[0],p[1]+T[1],p[2]+T[2]);c.N.push(n[0],n[1],n[2]);const cc=Array.isArray(col[0])?col[(i/3)|0]||col[0]:col;c.C.push(cc[0],cc[1],cc[2]);const ww=Wf?Wf(c.P.slice(-3)):null;c.W.push(ww?ww[0]:0,ww?ww[1]:0);}
  for(const i of idx)c.I.push(i+b);return this;};
/* pack (2.9.1, the trees): normals and colours as bytes (4 a vertex, one unused), the sway weight and phase as
   two bytes: 22 bytes a vertex instead of 44, half the forest's memory (colours must stay within 0..1) */
MB.prototype.upload=function(gl,pack){return this.chunks.filter(c=>c.I.length).map(c=>{const m={n:c.I.length},nv=c.P.length/3;
  {let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<nv;i++)for(let k=0;k<3;k++){const v=c.P[i*3+k];if(v<lo[k])lo[k]=v;if(v>hi[k])hi[k]=v;}m.c=[0,1,2].map(k=>(lo[k]+hi[k])/2);m.r=Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2;}   // (2.12) a bounding sphere per chunk: the scene's pieces are chunked by place (MB.fresh) and culled
  const buf=a=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;};
  m.vp=buf(new Float32Array(c.P));
  if(pack){const N=new Int8Array(nv*4),C=new Uint8Array(nv*4);for(let i=0;i<nv;i++)for(let k=0;k<3;k++){N[i*4+k]=Math.round(clamp(c.N[i*3+k],-1,1)*127);C[i*4+k]=Math.round(clamp(c.C[i*3+k],0,1)*255);}
    m.vn=buf(N);m.vc=buf(C);m.packed=true;
    if(this.hasW){const W=new Uint8Array(nv*2);for(let i=0;i<nv;i++){W[i*2]=Math.round(clamp(c.W[i*2],0,1)*255);W[i*2+1]=Math.round(clamp(c.W[i*2+1],0,1)*255);}m.vt=buf(W);}}   // (2.10: the second a flag, the trunk)
  else{m.vn=buf(new Float32Array(c.N));m.vc=buf(new Float32Array(c.C));
    if(this.hasW)m.vt=buf(new Float32Array(c.W));}   // (2.9) the trees' sway weights
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
const PERF={on:false,noChin:false,chinFull:false,scale:1};   // (2.12.3) the performance test's switches (95_ui.js perfStart)
function gfxEffective(){return cfg.gfx==='light'||(cfg.gfx!=='full'&&R3.soft)?'light':'full';}
function gfxSet(choice){cfg.gfx=choice;try{localStorage.setItem('ec135fd.gfx',choice);localStorage.removeItem('ec135fd.gfxAuto');}catch(e){}
  GFX.mode=gfxEffective();drsReset();}
function drsReset(){Object.assign(DRS,{s:1,win:[],good:0,floor:0.6,cap:1,capT:0,check:null});GFX.why='';}
function gfxPixelRatio(W,H){   // drawing-buffer pixels per page pixel: the screen's density (at most 2) within the budget, times the dynamic scale
  const dpr=Math.min(2,typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1);
  const r=Math.min(dpr,Math.sqrt((R3.soft&&cfg.gfx!=='full'?0.5e6:GFX.mode==='light'?1.2e6:2.6e6)/Math.max(1,W*H)));
  return (cfg.gfx==='full'?r:r*DRS.s)*(PERF.scale||1);}
/* Dynamic resolution: frame intervals in windows of 45 frames against 60 per second. A late window steps
   the scale down by 0.1; if the next window is not faster the pixels were not the bottleneck (the CPU or
   the screen is), so the step is undone and taken as the floor. Four windows with room step it back up; a
   step up that has to be taken back caps the scale there for a minute. */
function drsStep(dt){
  DRS.t+=dt;if(cfg.gfx==='full'||PERF.on||!(dt>0)||dt>0.25||DRS.t<2)return;
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
  R3.pr.skyFull=glProg(gl,VS_SKY,FS_SKY);R3.pr.skyLite=glProg(gl,VS_SKY,'#define LITE\n'+FS_SKY);R3.pr.tex=glProg(gl,VS_TEX,FS_TEX);R3.pr.shadow=glProg(gl,VS_LIT,FS_SHADOW);R3.pr.water=glProg(gl,VS_WATER,FS_WATER);R3.ext=gl.getExtension('ANGLE_instanced_arrays');R3.pr.inst=glProg(gl,VS_INST,FS_LIT.replace('varying vec3 vN;','varying vec3 vN;varying float vA;').replace('gl_FragColor=vec4(c,uAlpha);','gl_FragColor=vec4(c,uAlpha*vA);'));   // (2.9.2) the vegetation, instanced; (2.12) its alpha from the vertex shader, to the coverage
  R3.pr.shd=glProg(gl,VS_SHD,FS_SHD);R3.pr.shd.sway=true;R3.pr.instShd=glProg(gl,VS_INST_SHD,FS_SHD);   // (2.11) the scenery's shadows
  // what this GPU gives us; the far plane follows the depth buffer
  const hp=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  R3.info={deriv:R3.deriv,depthBits:gl.getParameter(gl.DEPTH_BITS),stencil:gl.getParameter(gl.STENCIL_BITS)>0,fragHighp:hp&&hp.precision>0,renderer:(gl.getExtension('WEBGL_debug_renderer_info')?gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL):'?')};
  R3.far=R3.info.depthBits>=24?9000:4500;
  // a software renderer (the browser's GPU switched off or blocklisted): auto picks light and a small pixel budget, no anisotropic filtering, and the side panel says so
  R3.soft=/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(String(R3.info.renderer));GFX.mode=gfxEffective();
  R3.noiseTex=makeNoiseTex(gl);R3.info.aniso=R3.aniso;
  {const L=TERRAIN.lake,N=256,d=new Uint8Array(N*4);for(let i=0;i<N;i++){const th=(i/N-0.5)*2*Math.PI,rl=L.r*(0.8+0.4*vnoise(2.2+Math.cos(th)*1.4,3.7+Math.sin(th)*1.4));d[i*4]=Math.round(clamp(rl,0,255));d[i*4+3]=255;}   // (2.10) the lake's shore radius by bearing, for the ground shader
   const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,N,1,0,gl.RGBA,gl.UNSIGNED_BYTE,d);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);R3.shoreTex=t;}
  console.log('EC135 Flight Dynamics GL:',JSON.stringify(R3.info));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  // sky dome
  {const b=new MB();const d=gEll([5000,5000,5000],24,12);b.add(d.P,d.N.map(v=>-v),[1,1,1],d.I.slice().reverse());R3.m.sky=b.upload(gl)[0];}
  // terrain: warped grid, fine near the pad (10 m), 30 m at 500 m, 75 m at 3 km, out to the hazy hills at 7 km (2.9; was 4 km)
  {const N=250;const P=[],Nn=[],C=[],I=[];const w=u=>7000*Math.sign(u)*u*u;
    const gN=(n,e)=>{const d=0.5,hn=(groundH(n+d,e)-groundH(n-d,e))/(2*d),he=(groundH(n,e+d)-groundH(n,e-d))/(2*d);return vnorm([-hn,-he,-1]);};
    for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const n=w(j/N*2-1),e=w(i/N*2-1);const hgt=groundH(n,e),nn=gN(n,e);P.push(n,e,-hgt);Nn.push(nn[0],nn[1],nn[2]);
      let fd=forestD(n,e);if(fd>0.4&&treeBlocked(n,e))fd=0;C.push(fd*(1-sm(420,500,hgt)),0,0);}   // (2.9.2) the forest's density for the floor under the trees (the shader's own noise was not the trees')
    const blocks=[],K=10,bs=N/K;   // (2.9.2) in blocks with a bounding sphere each (10 x 10 since 2.10): the blocks behind the camera are not drawn, the far ones get the light shader
    for(let bj=0;bj<K;bj++)for(let bi=0;bi<K;bi++){const I0=I.length;let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
      for(let j=bj*bs;j<(bj+1)*bs;j++)for(let i=bi*bs;i<(bi+1)*bs;i++){const a=j*(N+1)+i;I.push(a,a+1,a+N+1,a+1,a+N+2,a+N+1);for(const v of [a,a+N+2])for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P[v*3+k]);hi[k]=Math.max(hi[k],P[v*3+k]);}}
      blocks.push({o:I0*2,n:I.length-I0,c:[0,1,2].map(k=>(lo[k]+hi[k])/2),r:Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2});}
    const m={n:I.length,blocks};
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
  const wGround=p=>[-groundH(p[0],p[1]),1];b.wDefault=wGround;R3.parked=[];R3.houses=[];   // (2.11) every piece carries the ground's z under its vertices, for its shadow; the parked cars and the houses are listed for 86_life.js
  R3.veg=vegList();let nT=0;for(const v of R3.veg)if(v.kind==='pine'||v.kind==='broad')nT++;   // (2.9.2) the vegetation, drawn instanced (drawForest)
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
  b.wDefault=null;   // (no shadows: the lights, the wires)
  for(let i=0;i<12;i++){const a=i/12*2*Math.PI,n=9*Math.cos(a),e=9*Math.sin(a);const l=gBox([n,e,hAt(n,e)-0.08],[0.1,0.1,0.08]);b.add(l.P,l.N,[1.0,0.85,0.2],l.I);}
  for(let n=-900;n<=-100;n+=50)for(const e of [-161,-139]){const l=gBox([n,e,hAt(n,e)-0.2],[0.15,0.15,0.2]);b.add(l.P,l.N,n===-900||n===-100?[0.2,1.0,0.3]:[1.0,1.0,0.9],l.I);}
  b.wDefault=wGround;
  R3.socks=[[35,-45,7],[2366,700,6],[212,-872,6],[1563,-976,6],[-2258,-1458,5]];   // the field, the summit, the clearing, the hill, the high-rise (2.9)
  for(const [n,e,hp] of R3.socks)tube(b,[n,e,hAt(n,e)],[n,e,hAt(n,e)-hp],0.06,0.05,[0.8,0.8,0.8],6);
  {const [n,e]=HAPI.pos,z=hAt(n,e);const hb=gBox([n,e,z-0.25],[0.45,0.3,0.25]);b.add(hb.P,hb.N,[0.18,0.18,0.2],hb.I);const lg=gBox([n,e,z-0.04],[0.5,0.35,0.04]);b.add(lg.P,lg.N,[0.5,0.5,0.5],lg.I);}   // (2.15) the HAPI's housing west of the pad
  for(const [n,e] of [[25,25],[25,-25],[-25,25],[-25,-25]]){const c=gCone(0,0.35,-1.0,0.0,8);b.add(c.P,c.N,[0.95,0.45,0.1],c.I,{R:UPX,T:[n,e,hAt(n,e)]});}
  // power line along the north-south road: the hazard low flying is about
  for(let n=-1400;n<=1400;n+=70){const e=-322,z=hAt(n,e);tube(b,[n,e,z],[n,e,z-11],0.18,0.14,[0.45,0.40,0.35],5);const cb=gBox([0,0,-10.6],[0.12,1.6,0.08]);b.add(cb.P,cb.N,[0.45,0.40,0.35],cb.I,{T:[n,e,z]});}
  // every wire the rotor can hit (10_atmo.js WIRES: this line, the one across the river valley), as the physics sees it
  b.fresh();b.wDefault=null;for(const w of WIRES)if(w[6]!=='j')tube(b,[w[0],w[1],-w[2]],[w[3],w[4],-w[5]],0.03,0.03,[0.15,0.15,0.15],3);b.wDefault=wGround;
  b.fresh();
  // village east of the road
  R3.chimneys=[];
  for(let i=0;i<16;i++){const n=300+rng()*140,e=480+rng()*220;if(Math.abs(n-280)<14)continue;const z=hAt(n,e),w=5+rng()*3,l=6+rng()*4,hh=3+rng()*1.5;const R=rotZ(rng()<0.5?0:Math.PI/2);
    if(R3.chimneys.length<3){const ch=gBox([0,0,-hh-w*0.7-0.2],[0.35,0.35,0.8]);b.add(ch.P,ch.N,[0.55,0.32,0.25],ch.I,{T:[n,e,z]});R3.chimneys.push([n,e,z-hh-w*0.7-1.1]);}   // (2.9) three that smoke
    const hb=gBox([0,0,-hh/2],[l,w,hh/2]);b.add(hb.P,hb.N,[0.80+0.1*rng(),0.76,0.68],hb.I,{R,T:[n,e,z]});const rf=gRoof(l+0.4,w+0.4,-hh,-hh-w*0.7);b.add(rf.P,rf.N,[0.55+0.2*rng(),0.25,0.20],rf.I,{R,T:[n,e,z]});
    house(b,n,e,R,l,w,i%3===0,i%2===0);}   // (2.11) a garden with a fence behind, every third a car beside it
  {const z=hAt(400,600);const ch=gBox([0,0,-4],[8,5,4]);b.add(ch.P,ch.N,[0.82,0.80,0.74],ch.I,{T:[400,600,z]});const rf=gRoof(8.4,5.4,-8,-12);b.add(rf.P,rf.N,[0.4,0.4,0.42],rf.I,{T:[400,600,z]});
    const tw=gBox([9.5,0,-9],[2,2,9]);b.add(tw.P,tw.N,[0.82,0.80,0.74],tw.I,{T:[400,600,z]});const sp=gCone(0,2.4,-9,0.0,4);b.add(sp.P,sp.N,[0.35,0.35,0.38],sp.I,{R:UPX,T:[409.5,600,z-18]});
    // (2.11) the churchyard: a wall of 1.2 m round it with a gap at the gate, rows of gravestones
    for(const [cn,ce,sn,se] of [[0,-16,22,0.15],[0,16,22,0.15],[22,0,0.15,16],[-22,-7,0.15,9],[-22,9,0.15,7]]){const wl=gBox([cn,ce,-0.6],[sn,se,0.6]);b.add(wl.P,wl.N,[0.70,0.66,0.60],wl.I,{T:[400,600,hAt(400+cn,600+ce)]});}
    for(let i=0;i<5;i++)for(let j=0;j<7;j++){if(j===3)continue;const gn=400-19+i*3.2,ge=600-12+j*4,gs=gBox([0,0,-0.4],[0.1,0.35,0.4]);b.add(gs.P,gs.N,[0.58,0.57,0.55],gs.I,{T:[gn,ge,hAt(gn,ge)]});}}
  buildHamlet(b,hAt);   // (2.11) the second settlement, on the north-south road
  b.fresh();
  // hospital with the rooftop pad (the plateau the physics sees is in BUILDINGS)
  for(const bd of BUILDINGS){const z=-groundH(bd.n,bd.e);const bx=gBox([0,0,-bd.h/2],[bd.w,bd.l,bd.h/2]);b.add(bx.P,bx.N,[0.78,0.76,0.72],bx.I,{T:[bd.n,bd.e,z]});
    for(let f=1;f<bd.h/3.2;f++){const band=gBox([0,0,-f*3.2],[bd.w+0.05,bd.l+0.05,0.5]);b.add(band.P,band.N,[0.35,0.42,0.50],band.I,{T:[bd.n,bd.e,z]});}
    const wing=gBox([bd.w+12,0,-5],[12,bd.l,5]);b.add(wing.P,wing.N,[0.78,0.76,0.72],wing.I,{T:[bd.n,bd.e,z]});
    if(bd.pad){const pd=gDisc(0,11,32);b.add(pd.P,pd.N,[0.22,0.22,0.24],pd.I,{T:[bd.n,bd.e,z-bd.h-0.12]});const rg=gDisc(9.5,10.5,32);b.add(rg.P,rg.N,[0.95,0.95,0.92],rg.I,{T:[bd.n,bd.e,z-bd.h-0.20]});
      const hb=gBox([0,0,-bd.h-0.20],[2.2,0.35,0.02]);b.add(hb.P,hb.N,[0.95,0.95,0.92],hb.I,{T:[bd.n,bd.e,z]});for(const y of [-1.8,1.8]){const bb=gBox([0,y,-bd.h-0.20],[0.35,2.0,0.02]);b.add(bb.P,bb.N,[0.95,0.95,0.92],bb.I,{T:[bd.n,bd.e,z]});}
      for(let i=0;i<8;i++){const a=i/8*2*Math.PI;const l=gBox([13*Math.cos(a),13*Math.sin(a),-bd.h-0.6],[0.1,0.1,0.6]);b.add(l.P,l.N,[1.0,0.85,0.2],l.I,{T:[bd.n,bd.e,z]});}
      const rail=gBox([0,0,-bd.h-0.6],[bd.w,bd.l,0.05]);}
    const cross=gBox([bd.w+0.05,0,-bd.h*0.6],[0.05,2.5,0.6]);b.add(cross.P,cross.N,[0.85,0.15,0.15],cross.I,{T:[bd.n,bd.e,z]});const cross2=gBox([bd.w+0.05,0,-bd.h*0.6],[0.05,0.6,2.5]);b.add(cross2.P,cross2.N,[0.85,0.15,0.15],cross2.I,{T:[bd.n,bd.e,z]});}
  b.fresh();
  // wind turbine towers (the rotors are drawn live)
  R3.turbines=[[900,-700],[1010,-560],[1120,-420]];
  for(const [n,e] of R3.turbines){const z=hAt(n,e);tube(b,[n,e,z],[n,e,z-60],2.2,1.3,[0.90,0.90,0.90],10);}
  // jetty on the lake
  {const z=1.5;tube(b,[-300,520,hAt(-300,520)],[-330,530,z-0.6],0.5,0.5,[0.45,0.35,0.25],4);}
  buildWorld29(b,hAt);buildFarms(b,hAt);
  R3.m.scene=b.upload(gl);R3.nTrees=nT;R3.m.river=buildRivers(gl);
  const wb=new MB();const ws=gCone(0,0.35,2.6,0.12,8,false);wb.add(ws.P,ws.N,[1.0,0.45,0.05],ws.I);R3.m.sock=wb.upload(gl)[0];
  const tb=new MB();const nac=gBox([0,0,0],[3.6,1.4,1.4]);tb.add(nac.P,nac.N,[0.9,0.9,0.9],nac.I,{T:[-1.5,0,0]});for(let k=0;k<3;k++){const bl=gBox([0,0,-14.5],[0.25,0.7,14.5]);tb.add(bl.P,bl.N,[0.92,0.92,0.92],bl.I,{R:rotX(k*2*Math.PI/3),T:[2.4,0,0]});}R3.m.turbine=tb.upload(gl)[0];
}
/* 2.9: the bridge, the town (blocks, glass towers, the high-rise pad, the crane), the second power line's
   pylons with marker balls, the cones of the slope site */
function roofPad(b,n,e,z){const pd=gDisc(0,11,32);b.add(pd.P,pd.N,[0.22,0.22,0.24],pd.I,{T:[n,e,z-0.12]});const rg=gDisc(9.5,10.5,32);b.add(rg.P,rg.N,[0.95,0.95,0.92],rg.I,{T:[n,e,z-0.20]});
  const hb=gBox([0,0,-0.20],[2.2,0.35,0.02]);b.add(hb.P,hb.N,[0.95,0.95,0.92],hb.I,{T:[n,e,z]});for(const y of [-1.8,1.8]){const bb=gBox([0,y,-0.20],[0.35,2.0,0.02]);b.add(bb.P,bb.N,[0.95,0.95,0.92],bb.I,{T:[n,e,z]});}
  for(let i=0;i<8;i++){const a=i/8*2*Math.PI;const l=gBox([12*Math.cos(a),12*Math.sin(a),-0.6],[0.1,0.1,0.6]);b.add(l.P,l.N,[1.0,0.85,0.2],l.I,{T:[n,e,z]});}}
function buildWorld29(b,hAt){
  b.fresh();
  // the bridge where the road crosses the inflow (n 280, e 380): deck, railings, piers
  {const dk=gBox([280,380,-0.25],[5.6,75,0.3]);b.add(dk.P,dk.N,[0.40,0.40,0.41],dk.I);for(const dn of [-5.5,5.5]){const r=gBox([280+dn,380,-1.0],[0.08,75,0.45]);b.add(r.P,r.N,[0.75,0.75,0.73],r.I);}
   for(const de of [-26,-8,8,26]){const z=hAt(280,380+de);const pr=gBox([280,380+de,(z-0.6)/2],[4.2,0.7,Math.abs(z-0.6)/2+0.3]);b.add(pr.P,pr.N,[0.62,0.61,0.58],pr.I);}}
  b.fresh();
  // the town
  {const z=-TERRAIN.town.h,walls=[[0.82,0.78,0.70],[0.78,0.74,0.66],[0.86,0.83,0.76],[0.74,0.70,0.64],[0.80,0.62,0.52]];
   for(const bd of TOWN_B){const T=[bd.n,bd.e,z],c=bd.c===undefined?0.5:bd.c;
     if(bd.kind==='mast'){const Y=[0.95,0.74,0.10];const m=gBox([0,0,-bd.h/2],[0.9,0.9,bd.h/2]);b.add(m.P,m.N,Y,m.I,{T});
       const jb=gBox([0,19,-bd.h-0.6],[0.6,19,0.6]);b.add(jb.P,jb.N,Y,jb.I,{T});const cj=gBox([0,-6,-bd.h-0.6],[0.6,6,0.6]);b.add(cj.P,cj.N,Y,cj.I,{T});
       const cw=gBox([0,-10,-bd.h-0.2],[1.4,2,1.6]);b.add(cw.P,cw.N,[0.55,0.55,0.55],cw.I,{T});const cab=gBox([1.3,0.8,-bd.h+1.2],[0.9,0.9,1.0]);b.add(cab.P,cab.N,[0.85,0.85,0.82],cab.I,{T});
       const tp=gCone(0,1.2,-5,0.1,4);b.add(tp.P,tp.N,Y,tp.I,{R:UPX,T:[bd.n,bd.e,z-bd.h-1.2]});
       tube(b,[bd.n,bd.e+30,z-bd.h],[bd.n,bd.e+30,z-24],0.04,0.04,[0.15,0.15,0.15],3);const hk=gBox([0,30,-23.6],[0.4,0.4,0.4]);b.add(hk.P,hk.N,[0.85,0.2,0.1],hk.I,{T});continue;}
     const tower=bd.kind==='tower',wall=tower?[0.60+0.12*c,0.63+0.1*c,0.66+0.08*c]:walls[Math.min(4,Math.floor(c*5))];
     const bx=gBox([0,0,-bd.h/2],[bd.w,bd.l,bd.h/2]);b.add(bx.P,bx.N,wall,bx.I,{T});
     for(let f=0;(f+0.55)*3.2+(tower?1.0:0.55)<=bd.h-0.3;f++){const band=gBox([0,0,-(f+0.55)*3.2],[bd.w+0.04,bd.l+0.04,tower?1.0:0.55]);b.add(band.P,band.N,tower?[0.28+0.06*c,0.36+0.05*c,0.45]:[0.26,0.28,0.31],band.I,{T});}
     const rc=[wall[0]*0.78,wall[1]*0.78,wall[2]*0.78];   // the roof, flat at h as the physics sees it, and a low parapet round its edge (none round a pad)
     const rf=gBox([0,0,-bd.h-0.02],[bd.w,bd.l,0.03]);b.add(rf.P,rf.N,[0.46,0.46,0.47],rf.I,{T});
     if(!bd.pad)for(const [cn,ce,sn,se] of [[bd.w,0,0.15,bd.l],[-bd.w,0,0.15,bd.l],[0,bd.l,bd.w,0.15],[0,-bd.l,bd.w,0.15]]){const pw=gBox([cn,ce,-bd.h-0.45],[sn,se,0.45]);b.add(pw.P,pw.N,rc,pw.I,{T});}
     if(bd.pad)roofPad(b,bd.n,bd.e,z-bd.h);
     else if(bd.w>6&&bd.l>6){const mc=gBox([bd.w*0.3*(c-0.5),bd.l*0.2,-bd.h-1.1],[Math.min(3,bd.w*0.3),Math.min(2.5,bd.l*0.25),1.1]);b.add(mc.P,mc.N,[0.55,0.56,0.57],mc.I,{T});}}}
  b.fresh();
  // the line across the river valley: lattice pylons (square frustums), cross-arms, orange marker balls mid-span on the middle wire
  {const V=[[1180,-260],[1160,-20],[1140,220],[1120,460],[1100,700]];
   for(const [n,e] of V){const z=hAt(n,e),c=gCone(0,1.7,24,0.45,4,false);b.add(c.P,c.N,[0.62,0.63,0.64],c.I,{R:mmul(rotZ(Math.PI/4),UPX),T:[n,e,z]});const ca=gBox([0,0,-23.7],[2.9,0.25,0.25]);b.add(ca.P,ca.N,[0.62,0.63,0.64],ca.I,{T:[n,e,z]});}
   for(let i=0;i<V.length-1;i++){const m=[(V[i][0]+V[i+1][0])/2,(V[i][1]+V[i+1][1])/2],z=-((groundH(V[i][0],V[i][1])+groundH(V[i+1][0],V[i+1][1]))/2+24-4.5);
     for(const off of [-40,0,40]){const k=off/((Math.hypot(V[i+1][0]-V[i][0],V[i+1][1]-V[i][1]))/2),zz=z-4.5*(Math.abs(k));const ball=gEll([0.45,0.45,0.45],8,6);b.add(ball.P,ball.N,i%2?[0.95,0.95,0.95]:[0.95,0.42,0.08],ball.I,{T:[m[0]+(V[i+1][0]-V[i][0])*off/((Math.hypot(V[i+1][0]-V[i][0],V[i+1][1]-V[i][1]))),m[1]+(V[i+1][1]-V[i][1])*off/((Math.hypot(V[i+1][0]-V[i][0],V[i+1][1]-V[i][1]))),zz+0.45]});}}}
  b.fresh();
  // the factory by the town: a hall and its stack (it smokes: 86_life.js)
  {const n=-2100,e=-1150,z=hAt(n,e);tube(b,[n,e,z],[n,e,z-40],1.7,1.1,[0.55,0.30,0.22],10);for(const hz of [-12,-24,-36]){const r=gBox([0,0,hz],[1.6-0.012*Math.abs(hz),1.6-0.012*Math.abs(hz),0.25]);b.add(r.P,r.N,[0.85,0.85,0.85],r.I,{T:[n,e,z]});}
   const hall=gBox([-30,0,-6],[22,14,6]);b.add(hall.P,hall.N,[0.66,0.64,0.60],hall.I,{T:[n,e,z]});const sr=gRoof(22.4,14.4,-12,-15);b.add(sr.P,sr.N,[0.42,0.44,0.46],sr.I,{T:[n-30,e,z]});}
  b.fresh();
  // the slope site on the hill: four orange cones round a 14 m square
  for(const [dn,de] of [[7,7],[7,-7],[-7,7],[-7,-7]]){const n=1550+dn,e=-988+de,c=gCone(0,0.35,-1.0,0.0,8);b.add(c.P,c.N,[0.95,0.45,0.1],c.I,{R:UPX,T:[n,e,hAt(n,e)]});}
}
function buildRivers(gl){const b=new MB();
  for(const rv of RIVERS){const P=rv.P,L=rv.L,w=rv.w;let i0=0,i1=P.length-1;
    if(rv.lake==='end'){while(i1>0&&inLake(P[i1][0],P[i1][1]))i1--;}else{while(i0<P.length-1&&inLake(P[i0][0],P[i0][1]))i0++;}   // the lake has its own water
    const pos=[],nrm=[],col=[],idx=[];
    for(let i=i0;i<=i1;i++){const a=P[Math.max(0,i-1)],c=P[Math.min(P.length-1,i+1)],dx=c[0]-a[0],dy=c[1]-a[1],l=Math.hypot(dx,dy)||1,un=-dy/l,ue=dx/l,z=-(L[i]+0.06);
      for(const sd of [-1,-0.5,0,0.5,1]){pos.push(P[i][0]+un*w*sd,P[i][1]+ue*w*sd,z);nrm.push(0,0,-1);col.push([rv.S[i]/10,sd,0]);}   // (2.10) five across: the 0.4 % lift toward the eye is per vertex, a wide ribbon's middle would otherwise sink into the plain seen from above
      if(i<i1){const k=(i-i0)*5;for(let j=0;j<4;j++)idx.push(k+j,k+5+j,k+j+1,k+j+1,k+5+j,k+6+j);}}
    b.add(pos,nrm,col,idx);}
  return b.upload(gl);}
/* the crowns' shape: */
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
/* Rocks and reeds (2.9), meshed with the trees in their tiles: boulders in groups of one to four on the
   steep flanks and the high ground, a few on the hill pastures, none in the forest; stones along the
   rivers' banks and in their shallows; reeds in patches round the lake's shore, where the water is
   shallow, and along the rivers' lowland reaches. Their own random streams: the trees stand where they did. */
function natureList(T){
  const rr=makeRng(47);
  for(let n=-2700;n<=2700;n+=22)for(let e=-2700;e<=2700;e+=22){const jn=n+(rr()-0.5)*18,je=e+(rr()-0.5)*18,u=rr(),k=1+Math.floor(rr()*4),seed=rr();
    if(u>0.7||Math.hypot(jn,je)<450||forestD(jn,je)>0.55)continue;const g=groundH(jn,je);if(g<18)continue;
    const gn=(groundH(jn+2,je)-g)/2,ge=(groundH(jn,je+2)-g)/2,sl=Math.hypot(gn,ge);
    if(u>0.7*(0.9*sm(0.26,0.5,sl)+0.45*sm(280,520,g)+0.06*sm(40,90,g))||treeBlocked(jn,je))continue;
    const cr=makeRng(Math.floor(seed*1e6));for(let i=0;i<k;i++){const a=cr()*6.28,dd=i?2+cr()*4:0,sz=cr();
      T.push({n:jn+dd*Math.cos(a),e:je+dd*Math.sin(a),s:i?0.35+0.9*sz*sz:0.6+1.7*sz*sz,kind:'rock',sl,dark:0.8+0.4*cr()});}}
  const rq=makeRng(53);
  for(const rv of RIVERS)for(let i=0;i<rv.P.length-1;i++){const a=rv.P[i],b=rv.P[i+1];if(Math.abs(a[0])>2700||Math.abs(a[1])>2700)continue;
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]),un=-(b[1]-a[1])/len,ue=(b[0]-a[0])/len,low=rv.L[i]<12&&vnoise(a[0]/60+3.3,a[1]/60+1.7)>0.5;
    for(let k=0;k<4;k++){const f=rq(),sd=rq()<0.5?-1:1,off=rv.w*(0.7+0.7*rq()),sz=rq(),dk=rq();if(rq()>0.6)continue;   // stones
      const n=a[0]+(b[0]-a[0])*f+un*off*sd,e=a[1]+(b[1]-a[1])*f+ue*off*sd;if(inLake(n,e)||Math.hypot(n-280,e-380)<20)continue;
      T.push({n,e,s:0.3+0.8*sz*sz,kind:'rock',river:true,sl:0,dark:0.8+0.4*dk});}
    if(low)for(let k=0;k<6;k++){const f=rq(),sd=rq()<0.5?-1:1,off=rv.w+(rq()-0.3)*3,s=rq();   // reeds on the lowland banks
      const n=a[0]+(b[0]-a[0])*f+un*off*sd,e=a[1]+(b[1]-a[1])*f+ue*off*sd;if(inLake(n,e)||Math.hypot(n-280,e-380)<20)continue;T.push({n,e,s:0.7+0.4*s,kind:'reed'});}}
  const L=TERRAIN.lake;
  for(let n=L.n-320;n<=L.n+320;n+=3)for(let e=L.e-320;e<=L.e+320;e+=3){const jn=n+(rq()-0.5)*2.6,je=e+(rq()-0.5)*2.6,u=rq(),s=rq();
    const dl=Math.hypot(jn-L.n,je-L.e),th=Math.atan2(je-L.e,jn-L.n),rl=L.r*(0.8+0.4*vnoise(2.2+Math.cos(th)*1.4,3.7+Math.sin(th)*1.4));if(dl<rl||dl>rl+45)continue;   // the shore (10_atmo.js groundH)
    const g=groundH(jn,je);if(g<L.h+0.05||g>L.h+0.75||u>0.85*sm(0.35,0.6,vnoise(jn/35+2.1,je/35+6.3))||Math.hypot(jn+315,je-525)<14)continue;   // shallow water and the wet bank, in patches; not at the jetty
    T.push({n:jn,e:je,s:0.8+0.5*s,kind:'reed'});}}
function gRock(r,sa,sb,amp,rng,col){   // a lumpy ellipsoid, flat-shaded (each face its own normal and shade), flatter underneath
  const G=[];for(let j=0;j<=sb;j++){const t=j/sb*Math.PI,st=Math.sin(t),ct=Math.cos(t),row=[],k0=1+amp*(2*rng()-1),ao=rng()*0.6;
    for(let i=0;i<sa;i++){const a=(i+ao)/sa*2*Math.PI,k=j===0||j===sb?k0:1+amp*(2*rng()-1);row.push([st*Math.cos(a)*r[0]*k,st*Math.sin(a)*r[1]*k,-ct*r[2]*k*(ct<0?0.6:1)]);}G.push(row);}
  const P=[],N=[],C=[],I=[];
  const tri=(A,B,D)=>{let n=vcross(vsub(B,A),vsub(D,A));const l=vlen(n);if(l<1e-6)return;n=vscl(n,1/l);const m=vscl(vadd(vadd(A,B),D),1/3);if(vdot(n,m)<0){n=vscl(n,-1);[B,D]=[D,B];}
    const sh=(0.70+0.25*(-n[2])+0.10*(rng()-0.5))*(1+0.12*(rng()-0.5)),q=P.length/3;for(const v of [A,B,D]){P.push(v[0],v[1],v[2]);N.push(n[0],n[1],n[2]);C.push([col[0]*sh,col[1]*sh*(1+0.04*(rng()-0.5)),col[2]*sh]);}I.push(q,q+1,q+2);};
  for(let j=0;j<sb;j++)for(let i=0;i<sa;i++){const a=G[j][i],b=G[j][(i+1)%sa],c=G[j+1][i],d=G[j+1][(i+1)%sa];if(j>0)tri(a,b,c);if(j<sb-1)tri(b,d,c);}
  return {P,N,C,I};}
function gReeds(s,rng,lite){   // a clump of reed blades, both faces, green at the foot to straw at the tip; a few with a seed head
  const P=[],N=[],C=[],I=[],nb=lite?9:14;
  for(let i=0;i<nb;i++){const a=rng()*6.28,rb=0.55*s*Math.sqrt(rng()),x=rb*Math.cos(a),y=rb*Math.sin(a),hb=(1.0+1.0*rng())*s,la=Math.atan2(y,x)+(rng()-0.5)*1.6,lean=(0.06+0.22*rng())*hb,w=0.075*s,fa=rng()*6.28;
    const tip=[x+lean*Math.cos(la),y+lean*Math.sin(la),-hb],l=[x-w*Math.sin(fa),y+w*Math.cos(fa),0],r=[x+w*Math.sin(fa),y-w*Math.cos(fa),0],nv=vnorm([0.35*Math.cos(fa),0.35*Math.sin(fa),-1]);
    const g=rng(),foot=[0.17+0.04*g,0.30+0.05*g,0.11],top=[0.42+0.16*g,0.50+0.06*g,0.24+0.04*g],q=P.length/3;
    for(const [v,c] of [[l,foot],[r,foot],[tip,top]]){P.push(v[0],v[1],v[2]);N.push(nv[0],nv[1],nv[2]);C.push(c);}I.push(q,q+1,q+2,q,q+2,q+1);
    if(i%6===0){const hd=gBox([tip[0],tip[1],tip[2]+0.12*s],[0.035*s,0.035*s,0.13*s]);for(let k=0;k<hd.P.length;k+=3){P.push(hd.P[k],hd.P[k+1],hd.P[k+2]);N.push(hd.N[k],hd.N[k+1],hd.N[k+2]);C.push([0.36,0.24,0.15]);}const b0=q+3;for(const k of hd.I)I.push(k+b0);}}
  return {P,N,C,I};}
/* The vegetation (2.9.2): every tree, bush, rock and clump of reeds is an instance of one of a few shapes, drawn
   with ANGLE_instanced_arrays, so a real forest costs a few megabytes and draws in a few calls. The forests from
   the density function (10_atmo.js forestD): a jittered grid 9 m apart within 1.5 km of the field, 12 m further
   out to 2.7 km, the trees as tall as the crowns the physics sees (canopyH: 11 to 17 m, lower towards the tree
   line at 480 m), conifers or broadleaves by the stand and the height; at the edge (density 0.53 to 0.57) bushes
   and smaller trees; none where no tree may stand (treeBlocked), in the lake or on the steepest rock. Then the
   single trees, the confined area's ring, the clearing's two rows, the boulders, the river's stones and the
   reeds (natureList). 2.9 and 2.9.1 drew the forests' inside as a canopy mesh with trees round it: from the
   cockpit a strange green mass. */
/* Houses' surroundings (2.11): a garden behind a house, fenced (rails on corner posts), a shed in it; a car parked
   beside every third house (86_life.js draws them). The hamlet: eleven houses along the north-south road from
   640 to 790 N (east of it, and west beyond the power line), a chapel at its north end, a barn at the south. */
const HAMLET={n0:635,n1:810,e:-300};
function nearHamlet(n,e,r){return n>HAMLET.n0-r&&n<HAMLET.n1+r&&Math.abs(e-HAMLET.e)<75+r;}
function house(b,n,e,R,l,w,car,shed){const z=-groundH(n,e),T=[n,e,z],fl=10,fw=w+1.5,bk=-l-fl;   // the garden behind the house (its -x side)
  const rail=[0.55,0.45,0.32];for(const [cx,cy,sx,sy] of [[bk,0,0.04,fw],[(bk-l)/2,fw,(fl)/2,0.04],[(bk-l)/2,-fw,(fl)/2,0.04]])for(const zz of [-0.45,-0.9]){const r=gBox([cx,cy,zz],[sx,sy,0.03]);b.add(r.P,r.N,rail,r.I,{R,T});}
  for(const [cx,cy] of [[bk,fw],[bk,-fw],[-l,fw],[-l,-fw],[bk,0],[(bk-l)/2,fw],[(bk-l)/2,-fw]]){const p=gBox([cx,cy,-0.5],[0.06,0.06,0.5]);b.add(p.P,p.N,rail,p.I,{R,T});}
  if(shed){const sb=gBox([bk+2.2,fw-2.2,-1.1],[1.6,1.4,1.1]);b.add(sb.P,sb.N,[0.45,0.38,0.30],sb.I,{R,T});const sr=gRoof(1.8,1.6,-2.2,-3.0);b.add(sr.P,sr.N,[0.35,0.33,0.32],sr.I,{R,T:[n+mrot(R,[bk+2.2,fw-2.2,0])[0],e+mrot(R,[bk+2.2,fw-2.2,0])[1],z]});}
  R3.houses.push([n,e]);if(car){const q=mrot(R,[0,w+2.6,0]),psi=Math.atan2(R[3],R[0]);R3.parked.push([n+q[0],e+q[1],psi,groundH(n+q[0],e+q[1])]);}}
function buildHamlet(b,hAt){const rng=makeRng(37),H=HAMLET;b.fresh();
  const put=(n,e,facing,i)=>{const w=4.5+rng()*2,l=5.5+rng()*2.5,hh=3.0+rng()*1.3,R=rotZ(facing),z=hAt(n,e),T=[n,e,z];
    const hb=gBox([0,0,-hh/2],[l,w,hh/2]);b.add(hb.P,hb.N,[0.78+0.14*rng(),0.74+0.06*rng(),0.66],hb.I,{R,T});const rf=gRoof(l+0.4,w+0.4,-hh,-hh-w*0.65);b.add(rf.P,rf.N,[0.45+0.3*rng(),0.26,0.21],rf.I,{R,T});
    if(i%4===1){const ch=gBox([0,0,-hh-w*0.65-0.2],[0.3,0.3,0.7]);b.add(ch.P,ch.N,[0.55,0.32,0.25],ch.I,{T});}
    house(b,n,e,R,l,w,i%3===1,i%2===1);};
  let i=0;for(let n=650;n<=775;n+=25,i++)put(n,-255,Math.PI,i);   // east of the road, facing it (their gardens eastward)
  for(let n=660;n<=780;n+=30,i++)put(n,-352,0,i);                // west, beyond the power line
  {const n=H.n1-8,e=-255,z=hAt(n,e),T=[n,e,z];const ch=gBox([0,0,-3.5],[5,3.2,3.5]);b.add(ch.P,ch.N,[0.86,0.84,0.78],ch.I,{T});const rf=gRoof(5.4,3.6,-7,-10);b.add(rf.P,rf.N,[0.36,0.36,0.38],rf.I,{T});   // the chapel
   const tw=gBox([-3.5,0,-8],[1.2,1.2,8]);b.add(tw.P,tw.N,[0.86,0.84,0.78],tw.I,{T});const sp=gCone(0,1.5,-6,0.0,4);b.add(sp.P,sp.N,[0.36,0.36,0.38],sp.I,{R:UPX,T:[n-3.5,e,z-16]});}
  {const n=H.n0+8,e=-262,z=hAt(n,e),T=[n,e,z];const bb=gBox([0,0,-2.4],[9,5,2.4]);b.add(bb.P,bb.N,[0.58,0.50,0.40],bb.I,{T});const br=gRoof(9.4,5.4,-4.8,-7.6);b.add(br.P,br.N,[0.40,0.40,0.42],br.I,{T});}   // the barn
  R3.parked.push([H.n1-14,-262,Math.PI/2,groundH(H.n1-14,-262)]);}
/* Farms (2.10): eight farmsteads in the fields, placed by their own random stream where the land is flat, open
   and away from the field, the village, the town and the water: a house with a tiled roof, a barn with a grey
   roof, some a silo, each with four trees round it. Drawn only, not in the physics (as the village). */
let FARMS=null;
function farmSites(){if(FARMS)return FARMS;const F=[],rng=makeRng(23);
  for(let t=0;t<4000&&F.length<8;t++){const n=(rng()*2-1)*1500,e=(rng()*2-1)*1500,a=rng()<0.5?0:Math.PI/2,silo=rng()<0.5;
    if(Math.hypot(n,e)<380||Math.hypot(n-380,e-590)<260||forestD(n,e)>0.22||treeBlocked(n,e,45)||inLake(n,e)||nearHamlet(n,e,120))continue;
    const g=groundH(n,e);if(g>70||Math.hypot(groundH(n+6,e)-groundH(n-6,e),groundH(n,e+6)-groundH(n,e-6))/12>0.05)continue;
    if(F.some(f=>Math.hypot(f.n-n,f.e-e)<320))continue;F.push({n,e,a,silo,g});}
  return FARMS=F;}
function nearFarm(n,e,r){for(const f of farmSites())if(Math.hypot(f.n-n,f.e-e)<r)return true;return false;}
function buildFarms(b,hAt){const rng=makeRng(31);
  for(const f of farmSites()){b.fresh();const R=rotZ(f.a),z=hAt(f.n,f.e),T=[f.n,f.e,z];
    const hw=4.5+rng(),hl=5.5+1.5*rng(),hh=3.2+0.6*rng();const hb=gBox([0,0,-hh/2],[hl,hw,hh/2]);b.add(hb.P,hb.N,[0.84+0.08*rng(),0.78,0.68],hb.I,{R,T});const hr=gRoof(hl+0.4,hw+0.4,-hh,-hh-hw*0.75);b.add(hr.P,hr.N,[0.55+0.15*rng(),0.28,0.22],hr.I,{R,T});
    const bw=4.5,bl=8+2*rng(),bh=4.2;const bb=gBox([-hl-bl-6,0,-bh/2],[bl,bw,bh/2]);b.add(bb.P,bb.N,[0.62,0.55,0.45],bb.I,{R,T});const br=gRoof(bl+0.5,bw+0.5,-bh,-bh-bw*0.6);b.add(br.P,br.N,[0.40,0.40,0.42],br.I,{R,T});
    const sh=gBox([0,hw+9,-1.6],[6,3,1.6]);b.add(sh.P,sh.N,[0.50,0.46,0.40],sh.I,{R,T});const sr=gRoof(6.4,3.4,-3.2,-4.6);b.add(sr.P,sr.N,[0.45,0.42,0.40],sr.I,{R,T});   // a shed
    {const q=mrot(R,[hl+4,-hw-1,0]);R3.parked.push([f.n+q[0],f.e+q[1],f.a+Math.PI/2,groundH(f.n+q[0],f.e+q[1])]);}   // (2.11) a car in the yard
    if(f.silo){const sp=mrot(R,[-hl-bl-6,-bw-4,0]);tube(b,[f.n+sp[0],f.e+sp[1],z],[f.n+sp[0],f.e+sp[1],z-7.5],1.5,1.5,[0.72,0.74,0.76],10);const cap=gCone(0,1.6,-1.2,0.1,10);b.add(cap.P,cap.N,[0.55,0.56,0.58],cap.I,{R:UPX,T:[f.n+sp[0],f.e+sp[1],z-7.5]});}}}
function vegList(){const V=[],L=TERRAIN.lake,rr=makeRng(5),CS=30,G=new Map(),B=new Map();
  const cell=(M,n,e,f)=>{const i=Math.floor((n+3000)/CS),j=Math.floor((e+3000)/CS),k=i*1000+j;let v=M.get(k);if(v===undefined){v=f(i*CS-3000+CS/2,j*CS-3000+CS/2);M.set(k,v);}return v;};
  const GR=new Map(),grad=(n,e)=>cell(GR,n,e,(a,b)=>{const g0=groundH(a,b);return [(groundH(a+8,b)-g0)/8,(groundH(a,b+8)-g0)/8];});   // (2.11) the ground's gradient per 30 m cell, for the shadows' plane
  const add=(n,e,g,s,kind,o)=>{const gr=grad(n,e),pk=Math.floor(clamp((gr[0]+2)/4,0,1)*4095)*4096+Math.floor(clamp((gr[1]+2)/4,0,1)*4095);V.push(Object.assign({n,e,z:-g,s,kind,rot:rr()*6.2832,kxy:0.88+0.24*rr(),bright:0.85+0.3*rr(),ph:rr(),rank:o&&o.single?0:ngHash(n*0.37+1.3,e*0.61+2.9),gr:pk},o||{}));};   // rank: which are dropped first with distance (a hash of the place, so the random stream is as it was)
  for(const [lo,hi,SP,inner] of [[-1500,1500,9,0],[-2700,2700,12,1500]])
    for(let n=lo;n<=hi;n+=SP)for(let e=lo;e<=hi;e+=SP){if(inner&&Math.abs(n)<inner&&Math.abs(e)<inner)continue;
      const jn=n+(rr()-0.5)*SP*0.8,je=e+(rr()-0.5)*SP*0.8,u=rr(),v=rr(),w=rr();
      if(!cell(G,jn,je,(a,b)=>forestD(a,b)>0.40))continue;const d=forestD(jn,je);if(d<0.53||nearFarm(jn,je,32)||nearHamlet(jn,je,20))continue;   // (the density changes by less than 0.1 within a 30 m cell)
      if(cell(B,jn,je,(a,b)=>treeBlocked(a,b,22))&&treeBlocked(jn,je))continue;
      if(Math.abs(jn-L.n)<L.r*1.4&&Math.abs(je-L.e)<L.r*1.4&&inLake(jn,je))continue;
      const g=groundH(jn,je);if(g>480)continue;
      if(g>150&&Math.hypot(groundH(jn+2,je)-g,groundH(jn,je+2)-g)/2>0.7)continue;   // bare rock
      const edge=d<0.57;if(edge&&u>0.8)continue;
      if(edge&&u<0.45){add(jn,je,g,0.8+0.6*w,'bush');continue;}
      const con=clamp(0.35+0.8*(g-150)/300+(vnoise(jn/240+3.7,je/240+9.1)-0.5)*0.9,0,1),pine=v<con;
      const H=(11+6*vnoise(jn/90+4.4,je/90+1.1))*(1-0.3*sm(380,470,g))*(0.88+0.24*w)*(edge?0.8:1)*(inner?1.08:1);
      const st=vnoise(jn/170+7.7,je/170+2.3),birch=!pine&&g<160&&st>0.62&&rr()<0.5;   // (2.10) stands of birches on the low ground
      add(jn,je,g,pine?H/8.7:H/7.0,pine?'pine':'broad',{kz:pine?0.85+0.4*rr():0.8+0.5*rr(),hue:birch?0.6+0.4*rr():(st-0.5)*1.6+(rr()-0.5)*0.5,trunk:birch?1:0});}
  for(const f of farmSites())for(let i=0;i<4;i++){const a=f.a+i*1.5708+0.6,r=17+6*rr(),n=f.n+r*Math.cos(a),e=f.e+r*Math.sin(a);add(n,e,groundH(n,e),1.2+0.5*rr(),'broad',{single:true,kz:0.9+0.3*rr(),hue:(rr()-0.5)*0.6});}   // (2.10) the trees round the farms
  const sr=makeRng(3);
  for(let i=0;i<220;i++){const n=(sr()*2-1)*1400,e=(sr()*2-1)*1400,s=0.9+sr()*0.8;if(Math.hypot(n,e)<260||inLake(n,e)||treeBlocked(n,e)||forestD(n,e)>0.5||nearFarm(n,e,30)||nearHamlet(n,e,25))continue;add(n,e,groundH(n,e),s,'broad',{single:true,kz:0.85+0.4*sr(),hue:(sr()-0.5)*0.8});}   // single trees in the fields
  for(let i=0;i<8;i++)R3.parked.push([-258-21+i*3+(i>3?3:0),-378+(i%2?3.8:-3.8),Math.PI/2,groundH(-258,-378)]);   // (2.11) the hospital's car park
  for(const [n,e,s] of [[380,588,1.2],[380,612,1.1],[420,586,1.0],[662,-232,1.1],[712,-232,1.3],[762,-232,1.0],[690,-378,1.2],[750,-378,1.1],[804,-238,0.9]])add(n,e,groundH(n,e),s,'broad',{single:true,kz:0.9+0.3*sr(),hue:(sr()-0.5)*0.6});   // (2.11) the churchyard's and the hamlet's trees
  for(let i=0;i<14;i++){const a=i/14*2*Math.PI,n=260+28*Math.cos(a),e=-220+28*Math.sin(a);add(n,e,groundH(n,e),1.3,'broad',{single:true});}   // the confined area
  {const C=TERRAIN.clearing,cr=makeRng(59);   // the clearing: a row of tall trees from 28.6 m, smaller trees and bushes before it from 25 m
   for(let a=0;a<2*Math.PI-0.05;a+=0.142){const r=28.6+2.4*cr(),b=a+0.05*(cr()-0.5),n=C.n+r*Math.cos(b),e=C.e+r*Math.sin(b),s=1.35+0.35*cr(),pine=cr()<0.6;add(n,e,groundH(n,e),pine?s*1.15:s*1.3,pine?'pine':'broad',{single:true});}
   for(let a=0.07;a<2*Math.PI-0.05;a+=0.23){const r=25.4+2.0*cr(),b=a+0.06*(cr()-0.5),u=cr(),n=C.n+r*Math.cos(b),e=C.e+r*Math.sin(b);add(n,e,groundH(n,e),u<0.55?0.8+0.4*cr():0.95+0.3*cr(),u<0.55?'bush':cr()<0.5?'pine':'broad',{single:true});}}
  const N=[];natureList(N);   // boulders, stones, reeds
  for(const t of N){const g=groundH(t.n,t.e);
    if(t.kind==='rock')add(t.n,t.e,g+0.62*0.45*t.s-t.sl*0.5*t.s,t.s,'rock',{kxy:t.river?1.3:0.9+0.2*rr(),bright:t.dark*(t.river?1.13:1),rank:clamp(1-(t.s-0.3)/1.8,0,0.99)});   // sunk into the slope; the large ones kept furthest
    else add(t.n,t.e,g,t.s,'reed');}
  return V;}
/* The shapes, at unit size: a conifer of three tiers (8.7 m), a broadleaf with a lumpy crown and a smaller one
   beside it (7 m), each in three levels of detail (near, to ~900 m, beyond); a bush, a boulder, a clump of reeds. */
function vegTemplates(gl,lite){const rng=makeRng(17),T={},sway=H=>q=>[Math.pow(clamp(-q[2]/H,0,1),1.5),0];
  const up=(b)=>b.upload(gl,true)[0];
  const cone=(b,z,r,h,seg,col)=>{const c=gCone(0,r,h,0.04,seg,false),C=[];for(let v=0;v<c.P.length/3;v++){const k=v%2===0?0.72:1.08;C.push([col[0]*k,col[1]*k,col[2]*k]);}b.add(c.P,c.N,C,c.I,{R:mmul(rotZ(rng()*6.28),UPX),T:[0,0,z]},sway(9));};
  const pc=[0.10,0.27,0.12],bc=[0.215,0.405,0.135];
  const trunk=(b,h,r0,r1,seg)=>{const t=gCone(0,r0,-h,r1,seg,false);b.add(t.P,t.N,[0.30,0.22,0.14],t.I,{R:UPX},()=>[0,1]);};   // (aT.y = 1: the trunk, for a birch's white)
  {const b=new MB();trunk(b,2.2,0.22,0.15,lite?4:5);
   for(const [zz,r,hh] of lite?[[1.5,2.1,5.2],[4.0,1.4,3.8]]:[[1.4,2.2,4.4],[3.4,1.75,3.8],[5.5,1.2,3.2]])cone(b,-zz,r*(0.9+0.2*rng()),hh,lite?6:8,pc);T.pine0=up(b);}
  {const b=new MB();cone(b,-1.4,2.1,8.0,6,pc);T.pine1=up(b);}
  {const b=new MB();cone(b,-1.4,2.1,8.0,4,pc);T.pine2=up(b);}
  {const b=new MB();trunk(b,2.6,0.27,0.17,lite?4:6);
   const cr=gCrown([2.7,2.6,2.4],lite?8:9,5,0.16,rng,bc);b.add(cr.P,cr.N,cr.C,cr.I,{T:[0,0,-4.6]},sway(7));
   if(!lite){const l=gCrown([2.1,2.0,1.8],6,4,0.18,rng,bc);b.add(l.P,l.N,l.C,l.I,{T:[1.3,0,-3.6]},sway(7));}T.broad0=up(b);}
  {const b=new MB();trunk(b,2.6,0.27,0.17,3);   // (the trunk as near, so a tree changing its shape at 160 m keeps it)
   const cr=gCrown([2.8,2.8,2.6],6,3,0,rng,bc);b.add(cr.P,cr.N,cr.C,cr.I,{T:[0,0,-4.8]},sway(7));T.broad1=up(b);}
  {const b=new MB();const cr=gCrown([2.9,2.9,2.7],4,2,0,rng,bc);b.add(cr.P,cr.N,cr.C,cr.I,{T:[0,0,-4.9]},sway(7));T.broad2=up(b);}
  {const b=new MB();const cr=gCrown([1.9,1.7,1.3],lite?7:8,4,0.22,rng,[0.23,0.38,0.13]);b.add(cr.P,cr.N,cr.C,cr.I,{T:[0,0,-1.0]},sway(2.4));T.bush0=up(b);}
  {const b=new MB();const rk=gRock([1,0.78,0.62],lite?5:7,lite?3:4,0.2,rng,[0.53,0.50,0.45]);b.add(rk.P,rk.N,rk.C,rk.I);T.rock0=up(b);}
  {const b=new MB();const rd=gReeds(1,rng,lite);b.add(rd.P,rd.N,rd.C,rd.I,{},q=>[0.8*Math.pow(clamp(-q[2]/2,0,1),1.5),0]);T.reed0=up(b);}
  return T;}
/* Instances in 120 m tiles (each type's in its own buffer, by rank: the single trees first, then a hash of the
   place, the boulders the largest first; so the first part of a buffer is an even thinning of it), the tiles
   grouped by 6 x 6 into 720 m ones that hold the trees once more for the far shapes. */
function buildForest(gl,lite){const V=R3.veg,FT=120,CG=6,fine=new Map(),rng=makeRng(11);
  const pack=arr=>{const f=new Float32Array(arr.length*12),R=new Float32Array(arr.length);for(let i=0;i<arr.length;i++){const v=arr[i],c=Math.cos(v.rot)*v.kxy,s=Math.sin(v.rot)*v.kxy,rk=Math.floor(v.rank*1000),o=i*12;R[i]=rk/1000;f[o]=v.n;f[o+1]=v.e;f[o+2]=v.z;f[o+3]=v.s;f[o+4]=c;f[o+5]=s;f[o+6]=v.bright;f[o+7]=rk+Math.min(v.ph,0.999);f[o+8]=(v.kz===undefined?1:v.kz)*(v.kind==='reed'?-1:1);f[o+9]=v.hue||0;f[o+10]=v.trunk||0;f[o+11]=v.gr||0;}   // (2.11: aI2.w the ground's gradient; no shadow for the reeds)
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,f,gl.STATIC_DRAW);return {b,n:arr.length,ranks:R};};
  const order=(arr)=>arr.slice().sort((x,y)=>x.rank-y.rank);   // by rank: the first part of a buffer is what is kept further off
  const zbox=zs=>{let lo=1e9,hi=-1e9;for(const z of zs){lo=Math.min(lo,z);hi=Math.max(hi,z);}return [(lo+hi)/2,(hi-lo)/2];};
  for(const v of V){const fi=Math.floor((v.n+3000)/FT),fj=Math.floor((v.e+3000)/FT),k=fi*100+fj;let t=fine.get(k);if(!t){t={fi,fj,items:{},zs:[]};fine.set(k,t);}(t.items[v.kind]=t.items[v.kind]||[]).push(v);t.zs.push(v.z);}
  const coarse=new Map();
  for(const t of fine.values()){const n0=t.fi*FT-3000,e0=t.fj*FT-3000,[zm,zr]=zbox(t.zs),o={n0,e0,zlo:zm-zr,zhi:zm+zr,c:[n0+FT/2,e0+FT/2,zm-8],r:Math.hypot(FT/2,FT/2)+zr+25,bufs:{}};
    for(const k in t.items)o.bufs[k]=pack(order(t.items[k]));
    const ci=Math.floor(t.fi/CG),cj=Math.floor(t.fj/CG),ck=ci*100+cj;let c=coarse.get(ck);if(!c){c={n0:ci*CG*FT-3000,e0:cj*CG*FT-3000,fine:[],items:{pine:[],broad:[]},zs:[]};coarse.set(ck,c);}
    c.fine.push(o);for(const k of ['pine','broad'])if(t.items[k])for(const v of t.items[k])c.items[k].push(v);for(const z of t.zs)c.zs.push(z);}
  const C=[],h=FT*CG/2;for(const c of coarse.values()){const [zm,zr]=zbox(c.zs);c.zlo=zm-zr;c.zhi=zm+zr;c.c=[c.n0+h,c.e0+h,zm-8];c.r=Math.hypot(h,h)+zr+25;c.bufs={};for(const k of ['pine','broad'])if(c.items[k].length)c.bufs[k]=pack(order(c.items[k]));delete c.items;delete c.zs;C.push(c);}
  return {tpl:vegTemplates(gl,lite),coarse:C,FT,CS:FT*CG};}
/* Per frame (2.9.3): the 120 m tiles of the 720 m ones within ~750 m, the 720 m ones beyond (their trees once
   more, for the far shapes), to ~2.2 km. For each tile in view, each shape whose band of distances (trees: near
   to 160 m, middle to 750 m, far beyond) overlaps the tile's, with as many of its instances (in rank order) as
   can be kept at the tile's nearest point; the vertex shader sorts out the rest instance by instance. Trees:
   all kept to 350 m, 55 % at 600 m, 20 % at 1.2 km, none at 2.2 km, the kept ones up to 60 % larger; bushes
   to 350 m, boulders the largest first to 400 m, reeds to 180 m. The light mode: 55 % of the trees, 15 %
   larger, the distances three quarters. Near to far, so the depth test turns away what the nearer hide. */
const VEG_LOD={tree:{kd:[350,600,1200,2200],kv:[0.55,0.2],ce:0.3,bands:[['0',0,160],['1',160,750],['2',750,1e9]]},
  bush:{kd:[260,300,330,350],kv:[0.6,0.3],ce:0,bands:[['0',0,1e9]]},rock:{kd:[110,180,280,400],kv:[0.6,0.25],ce:0,bands:[['0',0,1e9]]},reed:{kd:[110,140,160,180],kv:[0.6,0.3],ce:0,bands:[['0',0,1e9]]}};
function vegKeep(L,d,sc,f){const D=L.kd.map(x=>x*sc),ss=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const k=d<D[1]?1+(L.kv[0]-1)*ss(D[0],D[1],d):d<D[2]?L.kv[0]+(L.kv[1]-L.kv[0])*ss(D[1],D[2],d):L.kv[1]*(1-ss(D[2],D[3],d));return k*f;}
function drawForest(P,eye,lite,rmax){const gl=R3.gl,ext=R3.ext,pr=R3.pr.inst;if(!ext||!pr)return;   // rmax: nothing beyond (the chin windows, 2.12.2)
  const key=lite?'forestLite':'forest';if(!R3.m[key])R3.m[key]=buildForest(gl,lite);const F=R3.m[key];
  const sc=lite?0.75:1,kf=lite?1.15:1,R1=750*sc,ez=eye[2],BW=15*sc;   // BW: half the width of a cross-fade between two shapes
  const range=(n0,e0,sz,zlo,zhi)=>{const dx=Math.max(n0-eye[0],0,eye[0]-n0-sz),dy=Math.max(e0-eye[1],0,eye[1]-e0-sz),fx=Math.max(Math.abs(eye[0]-n0),Math.abs(eye[0]-n0-sz)),fy=Math.max(Math.abs(eye[1]-e0),Math.abs(eye[1]-e0-sz));
    const zn=ez<zlo?zlo-ez:ez>zhi?ez-zhi:0,zf=Math.max(Math.abs(ez-zlo),Math.abs(ez-zhi));return [Math.hypot(dx,dy,zn),Math.hypot(fx,fy,zf)];};
  const upto=(r,k)=>{let lo=0,hi=r.length;while(lo<hi){const m=(lo+hi)>>1;if(r[m]<k)lo=m+1;else hi=m;}return lo;};   // instances of a rank below k
  const L={};let nd=0;
  const tile=(B,types,d0,d1)=>{for(const t of types){const b=B[t];if(!b)continue;const lod=VEG_LOD[t==='pine'||t==='broad'?'tree':t],f=t==='pine'||t==='broad'?(lite?0.55:1):1,dsc=t==='pine'||t==='broad'?sc:1;
      for(const [lv,lo,hi] of lod.bands){const blo=lo*dsc,bhi=hi*dsc;if(d1<blo-BW||d0>=bhi+BW)continue;const dm=Math.max(d0,blo-BW);if(dm>lod.kd[3]*dsc)continue;   // (the bands overlap by the cross-fade)
        const n=upto(b.ranks,vegKeep(lod,dm,dsc,f)+0.08);if(n>0)(L[t+lv]=L[t+lv]||[]).push([b.b,n,[blo,bhi],lod,dsc,f,dm]);}}};
  const RM=Math.min(2200*sc,rmax||1e9);
  for(const c of F.coarse){if(!sphereVisible(P,c.c,c.r))continue;const [c0,c1]=range(c.n0,c.e0,F.CS,c.zlo,c.zhi);if(c0>RM)continue;
    if(c0>R1+BW){tile(c.bufs,['pine','broad'],c0,c1);nd++;continue;}
    for(const o of c.fine){if(!sphereVisible(P,o.c,o.r)||!boxVisible(P,[o.n0,o.e0,o.zlo-22],[o.n0+F.FT,o.e0+F.FT,o.zhi+2]))continue;const [d0,d1]=range(o.n0,o.e0,F.FT,o.zlo,o.zhi);if(d0>RM)continue;nd++;tile(o.bufs,['pine','broad','bush','rock','reed'],d0,d1);}}   // (2.12.2) the box too: a sphere round a flat tile reaches far under the ground, where a view looking down goes on
  R3.tilesDrawn=nd;
  gl.useProgram(pr.p);gl.uniformMatrix4fv(pr.u.uMVP,false,R3.vp);gl.uniform3fv(pr.u.uSun,R3.sun);gl.uniform3fv(pr.u.uCam,R3.cam.pos);gl.uniform1f(pr.u.uAlpha,1);gl.uniform1f(pr.u.uSpec,0);
  gl.uniform3fv(pr.u.uFog,R3.fog);gl.uniform4fv(pr.u.uWash,R3.wash||[0,0,0,1]);gl.uniform1f(pr.u.uT,R3.time);gl.uniform1f(pr.u.uCloud,cfg.cloud);gl.uniform2fv(pr.u.uWind,R3.windXY||[0,0]);
  gl.uniform1f(pr.u.uFogK,R3.fogK||0.00026);gl.uniform3fv(pr.u.uSunC,R3.sunC||[1,1,1]);gl.uniform3fv(pr.u.uAmbC,R3.ambC||[1,1,1]);gl.uniform3fv(pr.u.uEye,eye);
  if(pr.u.uNoise){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,R3.noiseTex);gl.uniform1i(pr.u.uNoise,1);gl.activeTexture(gl.TEXTURE0);}
  const a=pr.a;gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);   // (2.12) the fades through the multisample coverage: no blending, no sorting, the depth test as for anything opaque
  for(const k of ['broad0','pine0','bush0','rock0','reed0','broad1','pine1','broad2','pine2']){if(!L[k])continue;const m=F.tpl[k];L[k].sort((x,y)=>x[6]-y[6]);   // near first
    gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.enableVertexAttribArray(a.aP);gl.vertexAttribPointer(a.aP,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.vn);gl.enableVertexAttribArray(a.aN);gl.vertexAttribPointer(a.aN,3,gl.BYTE,true,4,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.vc);gl.enableVertexAttribArray(a.aC);gl.vertexAttribPointer(a.aC,3,gl.UNSIGNED_BYTE,true,4,0);
    if(a.aT>=0){if(m.vt){gl.bindBuffer(gl.ARRAY_BUFFER,m.vt);gl.enableVertexAttribArray(a.aT);gl.vertexAttribPointer(a.aT,2,gl.UNSIGNED_BYTE,true,2,0);}else{gl.disableVertexAttribArray(a.aT);gl.vertexAttrib2f(a.aT,0,0);}}
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);
    for(const [b,n,band,lod,dsc,f] of L[k]){gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.enableVertexAttribArray(a.aI0);gl.vertexAttribPointer(a.aI0,4,gl.FLOAT,false,48,0);ext.vertexAttribDivisorANGLE(a.aI0,1);
      gl.enableVertexAttribArray(a.aI1);gl.vertexAttribPointer(a.aI1,4,gl.FLOAT,false,48,16);ext.vertexAttribDivisorANGLE(a.aI1,1);
      gl.enableVertexAttribArray(a.aI2);gl.vertexAttribPointer(a.aI2,4,gl.FLOAT,false,48,32);ext.vertexAttribDivisorANGLE(a.aI2,1);
      gl.uniform1f(pr.u.uK,k.startsWith('pine')||k.startsWith('broad')?kf:1);gl.uniform2f(pr.u.uBand,band[0],band[1]);gl.uniform1f(pr.u.uBW,BW);gl.uniform4f(pr.u.uKD,lod.kd[0]*dsc,lod.kd[1]*dsc,lod.kd[2]*dsc,lod.kd[3]*dsc);gl.uniform3f(pr.u.uKV,lod.kv[0],lod.kv[1],f);gl.uniform1f(pr.u.uCE,lod.ce);
      ext.drawElementsInstancedANGLE(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0,n);}}
  gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);for(const i of [a.aI0,a.aI1,a.aI2]){ext.vertexAttribDivisorANGLE(i,0);gl.disableVertexAttribArray(i);}if(a.aT>=0)gl.disableVertexAttribArray(a.aT);}
/* The trees' shadows (2.11): within R of the eye (fading over the last 60 m), the middle shapes, on the tangent
   plane at each foot; bushes and boulders too. Called inside the shadow pass (stencil, blending set up). */
function drawForestShadows(P,eye,lite,mg){const gl=R3.gl,ext=R3.ext,pr=R3.pr.instShd,F=R3.m[lite?'forestLite':'forest'];if(!ext||!pr||!F)return;   // mg: how far outside the view a tree may stand and still throw its shadow into it (default R; the chin windows 50 m: 17 m trees, the sun at 20° or higher)
  const R=lite?130:220,a=pr.a,dist=(n0,e0,sz)=>Math.hypot(Math.max(n0-eye[0],0,eye[0]-n0-sz),Math.max(e0-eye[1],0,eye[1]-e0-sz));
  gl.useProgram(pr.p);gl.uniformMatrix4fv(pr.u.uMVP,false,R3.vp);gl.uniform3fv(pr.u.uSun,R3.shSun);gl.uniform3fv(pr.u.uCam,R3.cam.pos);gl.uniform3fv(pr.u.uEye,eye);gl.uniform2f(pr.u.uBand,R-60,R);gl.uniform1f(pr.u.uAlpha,0.40);gl.uniform1f(pr.u.uK,lite?1.15:1);
  const L={};
  for(const c of F.coarse){if(dist(c.n0,c.e0,F.CS)>R)continue;for(const o of c.fine){if(dist(o.n0,o.e0,F.FT)>R)continue;const m=mg===undefined?R:mg,sx=R3.shSun[0],sy=R3.shSun[1],sl=Math.hypot(sx,sy)||1,mx=m*sx/sl,my=m*sy/sl;   // a tree throws its shadow away from the sun: the box reaches that way
    if(!sphereVisible(P,o.c,o.r+m)||!boxVisible(P,[o.n0-Math.max(0,mx),o.e0-Math.max(0,my),o.zlo-22],[o.n0+F.FT-Math.min(0,mx),o.e0+F.FT-Math.min(0,my),o.zhi+2]))continue;
    for(const [t,k] of [['pine','pine1'],['broad','broad1'],['bush','bush0'],['rock','rock0']])if(o.bufs[t])(L[k]=L[k]||[]).push(o.bufs[t]);}}
  for(const k in L){const m=F.tpl[k];gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.enableVertexAttribArray(a.aP);gl.vertexAttribPointer(a.aP,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);
    for(const bf of L[k]){gl.bindBuffer(gl.ARRAY_BUFFER,bf.b);
      gl.enableVertexAttribArray(a.aI0);gl.vertexAttribPointer(a.aI0,4,gl.FLOAT,false,48,0);ext.vertexAttribDivisorANGLE(a.aI0,1);
      gl.enableVertexAttribArray(a.aI1);gl.vertexAttribPointer(a.aI1,4,gl.FLOAT,false,48,16);ext.vertexAttribDivisorANGLE(a.aI1,1);
      gl.enableVertexAttribArray(a.aI2);gl.vertexAttribPointer(a.aI2,4,gl.FLOAT,false,48,32);ext.vertexAttribDivisorANGLE(a.aI2,1);
      ext.drawElementsInstancedANGLE(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0,bf.n);}}
  for(const i of [a.aI0,a.aI1,a.aI2]){ext.vertexAttribDivisorANGLE(i,0);gl.disableVertexAttribArray(i);}}
/* frustum test against the view-projection matrix (planes from its rows) */
function frustumPlanes(m){const r=i=>[m[i],m[4+i],m[8+i],m[12+i]],P=[];const w=r(3);
  for(const i of [0,1,2])for(const sg of [1,-1]){const a=r(i),p=[w[0]+sg*a[0],w[1]+sg*a[1],w[2]+sg*a[2],w[3]+sg*a[3]];const l=Math.hypot(p[0],p[1],p[2]);P.push(p.map(v=>v/l));}return P;}
function sphereVisible(P,c,r){for(const p of P)if(p[0]*c[0]+p[1]*c[1]+p[2]*c[2]+p[3]<-r)return false;return true;}
function boxVisible(P,lo,hi){for(const p of P)if(p[0]*(p[0]>0?hi[0]:lo[0])+p[1]*(p[1]>0?hi[1]:lo[1])+p[2]*(p[2]>0?hi[2]:lo[2])+p[3]<0)return false;return true;}   // (2.12.2) an axis-aligned box: its corner furthest along each plane's normal
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
  const db=new MB();const dd=gDisc(0.4,4.5,40);db.add(dd.P,dd.N,[0.6,0.6,0.62],dd.I);R3.m.disc=db.upload(gl)[0];const rmb=new MB(),rd=gDisc(4.5,5.1,40);rmb.add(rd.P,rd.N,[0.6,0.6,0.62],rd.I);R3.m.discRim=rmb.upload(gl)[0];   // (2.9) the tips' part fainter: the blur has no hard edge
  const sb=new MB();const sd=gDisc(0,5.2,32);sb.add(sd.P,sd.N,[0.05,0.05,0.05],sd.I);R3.m.shadow=sb.upload(gl)[0];
  const cb=new MB();const cc=gCone(0,2.2,9,2.2,16,false);cb.add(cc.P,cc.N,[1.0,0.72,0.1],cc.I);R3.m.column=cb.upload(gl)[0];   // tutor target
  {const rb=new MB();const rc=gCone(-0.4,4.5,0.4,4.5,32,false);rb.add(rc.P,rc.N,[1.0,0.72,0.1],rc.I);R3.m.ring=rb.upload(gl)[0];}   // click to fly: the ring at a target's height in the air (92_coach.js)
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
/* (2.17.2) No discard: a shader that discards keeps many GPUs from testing the depth before it runs, so every
   sprite was shaded also where the panel or the floor hides it; the corners are alpha 0 now (the particles do
   not write depth, so nothing changes in the picture). At most 128 px (was 256), and faded out within 1.5-4 m
   of the eye, where a sprite of dust filled a quarter of the screen. */
const VS_PART=`attribute vec3 aP;attribute vec4 aC;uniform mat4 uMVP;uniform float uScale;varying vec4 vC;varying float vF;
void main(){vec4 c=uMVP*vec4(aP,1.0);gl_Position=c;gl_PointSize=clamp(aC.a*uScale/max(c.w,0.5),1.0,128.0);vC=aC;vF=smoothstep(1.5,4.0,c.w);}`;
const FS_PART=`${GLSL_PREC}varying vec4 vC;varying float vF;uniform float uAlpha;void main(){vec2 q=gl_PointCoord-0.5;float r=dot(q,q)*4.0;gl_FragColor=vec4(vC.rgb,max(0.0,1.0-r)*uAlpha*vF);}`;
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
  if(inWater(n,e))return 'water';
  {const T=TERRAIN.town;if(n>T.n0&&n<T.n1&&e>T.e0&&e<T.e1)return 'paved';}
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
function drawMesh(pr,m,M,alpha=1,parts){const gl=R3.gl;gl.useProgram(pr.p);
  gl.bindBuffer(gl.ARRAY_BUFFER,m.vp);gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,0,0);
  const pk=m.packed;
  if(pr.a.aN>=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.vn);gl.enableVertexAttribArray(pr.a.aN);if(pk)gl.vertexAttribPointer(pr.a.aN,3,gl.BYTE,true,4,0);else gl.vertexAttribPointer(pr.a.aN,3,gl.FLOAT,false,0,0);}
  if(pr.a.aC>=0){gl.bindBuffer(gl.ARRAY_BUFFER,m.vc);gl.enableVertexAttribArray(pr.a.aC);if(pk)gl.vertexAttribPointer(pr.a.aC,3,gl.UNSIGNED_BYTE,true,4,0);else gl.vertexAttribPointer(pr.a.aC,3,gl.FLOAT,false,0,0);}
  if(pr.a.aT>=0&&pr.sway){if(m.vt){gl.bindBuffer(gl.ARRAY_BUFFER,m.vt);gl.enableVertexAttribArray(pr.a.aT);if(pk)gl.vertexAttribPointer(pr.a.aT,2,gl.UNSIGNED_BYTE,true,2,0);else gl.vertexAttribPointer(pr.a.aT,2,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(pr.a.aT);const k=pr.aTconst||[0,0];gl.vertexAttrib2f(pr.a.aT,k[0],k[1]);}}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);
  gl.uniformMatrix4fv(pr.u.uMVP,false,m4mul(R3.vp,M));if(pr.u.uM)gl.uniformMatrix4fv(pr.u.uM,false,M);
  gl.uniform3fv(pr.u.uSun,R3.sun);gl.uniform3fv(pr.u.uCam,R3.cam.pos);if(pr.u.uAlpha)gl.uniform1f(pr.u.uAlpha,alpha);
  gl.uniform3fv(pr.u.uFog,R3.fog);if(pr.u.uSpec)gl.uniform1f(pr.u.uSpec,R3.spec||0);if(pr.u.uWash)gl.uniform4fv(pr.u.uWash,R3.wash||[0,0,0,1]);if(pr.u.uT)gl.uniform1f(pr.u.uT,R3.time);if(pr.u.uCloud)gl.uniform1f(pr.u.uCloud,cfg.cloud);if(pr.u.uWind)gl.uniform2fv(pr.u.uWind,R3.windXY||[0,0]);if(pr.u.uFogK)gl.uniform1f(pr.u.uFogK,R3.fogK||0.00026);if(pr.u.uSunC)gl.uniform3fv(pr.u.uSunC,R3.sunC||[1,1,1]);if(pr.u.uAmbC)gl.uniform3fv(pr.u.uAmbC,R3.ambC||[1,1,1]);if(pr.u.uZen)gl.uniform3fv(pr.u.uZen,R3.zen||[0.30,0.48,0.82]);
  if(pr.u.uNoise){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,R3.noiseTex);gl.uniform1i(pr.u.uNoise,1);gl.activeTexture(gl.TEXTURE0);}
  if(pr.u.uShore){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,R3.shoreTex);gl.uniform1i(pr.u.uShore,2);gl.activeTexture(gl.TEXTURE0);}
  if(parts){for(const b of parts)gl.drawElements(gl.TRIANGLES,b.n,gl.UNSIGNED_SHORT,b.o);}else gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0);}
/* The world's static part, the ground and the shadows, as functions (2.12), drawn for the camera and
   view-projection in R3 (cam, vp). */
function sceneVisible(P){return R3.m.scene.filter(m=>sphereVisible(P,m.c,m.r));}   // (2.12) the scene's chunks in view
function drawStatics(cpos,lite,dt,rmax){const gl=R3.gl,P=frustumPlanes(R3.vp);   // rmax: the cars within it only, no boat or birds (the chin windows)
  for(const m of sceneVisible(P))drawMesh(R3.pr.lit,m,M4I);
  drawForest(P,cpos,lite,rmax);   // (2.9.2) trees, bushes, rocks, reeds
  {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.2?Math.atan2(w[1],w[0]):WIND.dir*DEG+Math.PI;const droop=lerp(65*DEG,3*DEG,clamp(ws/7,0,1));   // windsock: points downwind, droops when calm
    const Rm=mmul(rotZ(az),rotY(-droop));for(const [n,e,hp] of R3.socks){if(!sphereVisible(P,[n,e,-terrainH(n,e)-hp],6))continue;drawMesh(R3.pr.lit,R3.m.sock,m4model(Rm,[n,e,-terrainH(n,e)-hp]));}}   // (2.12.8) only those in view
  {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.5?Math.atan2(-w[1],-w[0]):WIND.dir*DEG;R3.turb+=dt*clamp(ws/6,0.15,1)*1.3;   // wind turbines: face the wind, turn with it
    for(const [n,e] of R3.turbines){if(!sphereVisible(P,[n,e,-terrainH(n,e)-60],75))continue;drawMesh(R3.pr.lit,R3.m.turbine,m4model(mmul(rotZ(az),rotX(R3.turb)),[n,e,-terrainH(n,e)-60]));}}
  lifeDraw(dt,rmax);}   // cars, the boat, birds (86_life.js)
function drawGround(cpos,lite){const gl=R3.gl;
  {const g=R3.m.ground,P=frustumPlanes(R3.vp),R=[[],[]];let cur=null,cls=-1;   // (2.9.2) only the ground's blocks in view; (2.10) those beyond ~900 m with the light shader (a pixel covers over a metre there: none of the fine detail is left to see); consecutive blocks of a kind in one call
   for(const b of g.blocks){const k=!sphereVisible(P,b.c,b.r)?0:(lite||Math.hypot(b.c[0]-cpos[0],b.c[1]-cpos[1],b.c[2]-cpos[2])-b.r>900)?2:1;
     if(k&&k===cls&&cur&&cur.o+cur.n*2===b.o)cur.n+=b.n;else if(k){cur={o:b.o,n:b.n};R[k-1].push(cur);}else cur=null;cls=k;}
   if(R[0].length)drawMesh(R3.pr.gnd,g,M4I,1,R[0]);if(R[1].length)drawMesh(lite?R3.pr.gnd:R3.pr.gndLite,g,M4I,1,R[1]);}
  if(R3.m.river){gl.disable(gl.CULL_FACE);for(const m of R3.m.river)drawMesh(R3.pr.water,m,M4I);gl.enable(gl.CULL_FACE);}}   // the rivers, over the flood plain
/* Shadow: every aircraft mesh projected along the sun onto the ground plane under the aircraft.
   The stencil lets each pixel be darkened once, however many shadow triangles cover it (without
   a stencil buffer, depth-equal rejection does the same, less cleanly). (2.11) the scenery's first. */
function drawShadows(cpos,lite,A,near){const gl=R3.gl,{R,rt,st,hubW,Rh}=A;   // near: the chin windows' pass (2.12.2), the scenery's shadows only from close by
  const sun=R3.shSun,zg=-terrainH(S.pos[0],S.pos[1])-0.03,kx=sun[0]/sun[2],ky=sun[1]/sun[2];
  const Sh=new Float32Array([1,0,0,0, 0,1,0,0, -kx,-ky,0,0, kx*zg,ky*zg,zg,1]);   // column-major: x' = x - kx (z - zg), y' = y - ky (z - zg), z' = zg
  const hAbove=-S.pos[2]-terrainH(S.pos[0],S.pos[1]),al=clamp(0.42-hAbove*0.0035,0.06,0.42);
  const stc=R3.info&&R3.info.stencil;
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-2,-8);gl.disable(gl.CULL_FACE);
  if(stc){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,0xff);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);gl.depthMask(false);}else gl.depthFunc(gl.LESS);
  const shd=(m,Mm,a)=>drawMesh(R3.pr.shadow,m,m4mul(Sh,Mm),a);
  {const sv=R3.sun;R3.sun=R3.shSun;const P=frustumPlanes(R3.vp);   // (2.11) the scenery's shadows first: the buildings, the turbines' rotors, the cars near by, the trees
   for(const m of sceneVisible(P))drawMesh(R3.pr.shd,m,M4I,0.42);
   {const w=S.wind,ws=Math.hypot(w[0],w[1]);const az=ws>0.5?Math.atan2(-w[1],-w[0]):WIND.dir*DEG;for(const [n,e] of R3.turbines){if(Math.hypot(n-cpos[0],e-cpos[1])>(near?300:900))continue;R3.pr.shd.aTconst=[-terrainH(n,e),1];drawMesh(R3.pr.shd,R3.m.turbine,m4model(mmul(rotZ(az),rotX(R3.turb)),[n,e,-terrainH(n,e)-60]),0.42);}}
   if(typeof lifeShadows==='function')lifeShadows((m,M,zg)=>{R3.pr.shd.aTconst=[zg,1];drawMesh(R3.pr.shd,m,M,0.42);},cpos,near?Math.min(400,near):400);
   R3.pr.shd.aTconst=null;drawForestShadows(P,cpos,lite,near?50:undefined);R3.sun=sv;}
  shd(R3.m.body,m4model(R,S.pos),al);shd(R3.m.hub,m4model(Rh,hubW),al);
  for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;const a=Math.atan2(-rt.s*Math.sin(psi),-Math.cos(psi));shd(R3.m.blade,m4model(mmul(Rh,mmul(rotZ(a),rotY(st.beta[k]))),hubW),al);}
  if(st.Om>15){if(stc)gl.stencilFunc(gl.EQUAL,0,0xff);shd(R3.m.disc,m4model(Rh,hubW),al*0.18*clamp((st.Om-15)/25,0,1));}   // the spinning disc dims the ground a little
  if(stc){gl.disable(gl.STENCIL_TEST);gl.depthMask(true);}
  gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);}
/* The approach view (2.12). Below ~60 m and under ~40 kt on an approach the pilot's gaze lowers by itself, as a
   pilot's does on short final: the line of sight goes down to 25°, the view grows taller (75° instead of 62°), and
   with it the cockpit moves up the screen: the panel rises from the bottom to where it hangs in the airframe and
   under it the chin windows come into view (89_panel.js draws their frame), the ground 1-4 m ahead of the skids,
   the pad's markings, the aircraft's shadow. One picture, one projection: what leaves the windscreen's lower edge
   reappears under the panel where it belongs. The horizon stays in the top sixth of the view. The blend k follows
   height and ground speed with a 1.5 s lag, so it slides once per approach, not with every gust.
   (2.12.4) Only by key (4) since 2.12.4; the arming below decides the hint that offers it (and the one that
   offers the normal view back on a departure), no longer the view itself.
   (2.12.1) Only on the approach, never on the take-off: there the lowered gaze takes the horizon's picture away
   while the attitude is being set. The view is armed when the aircraft has been away from the ground (above ~90 m
   or faster than ~55 kt: the next time it is low and slow it is arriving), or when a flight starts in the air
   above 30 m or faster than 20 kt (the approach exercises); it is disarmed after 2 s on the skids (the next lift-
   off is a departure) and by a departure from the hover or a go-around (2.5 s of climbing above 300 fpm while
   speeding up, or above 600 fpm: a flare slows down, a correction in the hover is short). A flight that starts
   in the hover or on the pad starts disarmed.
   Automatic (cfg.apr 'auto'), held ('on') or never ('off'); key 4. */
const APR={k:0,armed:false,gT:0,dT:0,gs:0,acc:0,hint:'',hintT:0};
function aprEnv(){const gs=Math.hypot(S.vb[0],S.vb[1])/KT,h=-S.pos[2]-terrainH(S.pos[0],S.pos[1])-1.3;   // the skids' height (S.hAGL, also before the first step)
  return {h,gs,k:sm(90,45,h)*sm(55,30,gs)};}
function aprWant(){return cfg.apr==='on'?1:0;}   // (2.12.4) by key only (4): the situation gives a hint (aprHint), not the view
function aprArm(dt){const E=aprEnv();
  if(APR.S!==S){APR.armed=E.h>30||E.gs>20;APR.gT=0;APR.dT=0;APR.gs=E.gs;APR.acc=0;return;}   // a new flight: in the air and moving, an approach; in the hover or on the pad, a departure
  if(!(dt>0))return;
  APR.acc+=((E.gs-APR.gs)/dt-APR.acc)*Math.min(1,dt/0.6);APR.gs=E.gs;   // ground speed's rate, kt/s, smoothed
  if(E.k<0.02){APR.armed=true;APR.dT=0;APR.gT=0;return;}   // away from the ground: the next low and slow is an arrival
  APR.gT=S.onGround?APR.gT+dt:0;if(APR.gT>2)APR.armed=false;   // landed: the next lift-off is a departure
  const fpm=S.vs/FPM;if((fpm>300&&APR.acc>0.3)||fpm>600)APR.dT+=dt;else APR.dT=Math.max(0,APR.dT-dt);if(APR.dT>2.5)APR.armed=false;}   // climbing and speeding up, or climbing fast: a departure (a flare slows down, a correction in the hover is short)
function aprStep(dt){const rp=typeof REPLAY==='object'&&REPLAY.on,fresh=!rp&&APR.S!==S;if(!rp)aprArm(dt);if(fresh){APR.S=S;APR.k=aprWant();return;}   // a new flight (placeAt): straight to its view, no slide; in the replay (a state of its own every frame) the arming stands still
  APR.k+=(aprWant()-APR.k)*Math.min(1,dt/1.5);if(APR.k<0.002)APR.k=0;if(APR.k>0.998)APR.k=1;
  aprHint(dt,rp);}
/* (2.12.4) The hint (90_hud.js draws it above the panel, 8 s from the moment the situation arises): on an
   approach, low and slow, with the view off, '4 approach view'; on a departure (the view disarmed: after a
   landing, on the pad, in the hover, climbing away) with the view on, '4 back to the normal view'. */
function aprHint(dt,rp){const E=aprEnv(),h=rp||cfg.view!=='cockpit'?'':cfg.apr==='on'?(!APR.armed?'dep':''):(APR.armed&&E.k>0.6&&!S.onGround?'apr':'');
  if(APR.ack){APR.ack=false;APR.hint=h;APR.hintT=99;return;}   // the key was pressed: the situation as it now stands needs no hint
  if(h!==APR.hint){APR.hint=h;APR.hintT=0;}else APR.hintT+=dt;}
/* (2.12.2) The chin windows: their own small pass, after the main one (2.12.3: one for both). The main pass stops under the
   panel's top (the scissor, as in the normal cockpit view); each window's screen rectangle is then drawn
   with a projection cut down to it (the same pixels as the full view's projection would give, the frustum
   only as wide as the window, so only what is in it is drawn): the aircraft, the scenery and trees in it,
   the cars within reach, the ground, the shadows, the target's column and the predicted path. No sky (the
   windows look 36-60° down) and no downwash particles (right under the eye they are large sprites: the
   overdraw that made 2.12's approach view slow). */
function subRectM(x,y,w,h,bw,bh){const ax=x/bw*2-1,bx=(x+w)/bw*2-1,ay=y/bh*2-1,by=(y+h)/bh*2-1;
  return new Float32Array([2/(bx-ax),0,0,0, 0,2/(by-ay),0,0, 0,0,1,0, -(bx+ax)/(bx-ax),-(by+ay)/(by-ay),0,1]);}   // NDC of the rectangle onto the whole of NDC
/* (2.17.2) The chin windows in the view's own pass. Until 2.17.1 they were a picture of their own (2.12.4-2.12.8:
   drawn into a framebuffer of their own at half the resolution and laid in through a glass), which cost a second
   pass over the scene and, on integrated graphics and Vulkan drivers, the switch of framebuffers itself; off by
   default since 2.13 for that. Now, with the panel lifted (the approach view), the view is drawn over the whole
   screen, and first the band from the panel's top down is written into the depth buffer at the near plane with
   the colour off, the two windows (3 cm wider than the floor's openings, which 89_panel.js draws over them with
   their rims and the glass's tint) punched back to the far plane. The depth test then turns the scene away
   behind the panel and the floor before it is shaded: what is shaded is what shows, above the panel and in the
   windows, in one pass. */
function chinOcclOn(){return cfg.view==='cockpit'&&!cfg.panel3d&&HUD.panelUp>0&&HUD.panelA>0.99&&!!PANEL.lay&&!PERF.noChin;}
function chinOccl(W,Hh,pxr,bw,bh){const gl=R3.gl;
  if(!R3.pr.mask){R3.pr.mask=glProg(gl,'attribute vec3 aP;void main(){gl_Position=vec4(aP,1.0);}',GLSL_PREC+'void main(){gl_FragColor=vec4(0.0);}');R3.maskBuf=gl.createBuffer();}
  /* (2.17.3) Only ever nearer: the band less the windows, cut into trapezoids between the heights of the windows'
     corners, written with the ordinary depth test. 2.17.2 wrote the whole band near and the windows back to the far
     plane with the test off; a depth buffer written farther within a frame loses the GPU's coarse per-tile depth
     (hierarchical Z on AMD), and with it the early rejection the whole scheme rests on. */
  const N=(x,y)=>[x*pxr/bw*2-1,(Hh-y)*pxr/bh*2-1],T=[],yT=HUD.panelTop+20,Q=chinQuads(0.03);
  const quad=(ax,ay,bx,by,cx,cy,dx,dy)=>{const v=[N(ax,ay),N(bx,by),N(cx,cy),N(dx,dy)];for(const k of [0,1,2,0,2,3])T.push(v[k][0],v[k][1],-0.99999);};
  const span=(q,y)=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];
      if(a[1]===y){lo=Math.min(lo,a[0]);hi=Math.max(hi,a[0]);}
      if((a[1]-y)*(b[1]-y)<0){const x=a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);lo=Math.min(lo,x);hi=Math.max(hi,x);}}
    return lo<=hi?[lo,hi]:null;};
  const ys=[yT,Hh+2];for(const q of Q)for(const v of q)if(v[1]>yT&&v[1]<Hh+2)ys.push(v[1]);ys.sort((a,b)=>a-b);
  for(let k=0;k+1<ys.length;k++){const y0=ys[k],y1=ys[k+1];if(y1-y0<0.01)continue;const ym=(y0+y1)/2;
    const holes=Q.map(q=>({q,m:span(q,ym)})).filter(h=>h.m).sort((a,b)=>a.m[0]-b.m[0]);let l0=0,l1=0;
    for(const h of holes){const s0=span(h.q,y0)||h.m,s1=span(h.q,y1)||h.m;quad(l0,y0,s0[0],y0,s1[0],y1,l1,y1);l0=s0[1];l1=s1[1];}
    quad(l0,y0,W,y0,W,y1,l1,y1);}
  const pr=R3.pr.mask;gl.useProgram(pr.p);gl.bindBuffer(gl.ARRAY_BUFFER,R3.maskBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(T),gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,0,0);
  gl.colorMask(false,false,false,false);gl.disable(gl.CULL_FACE);gl.depthFunc(gl.LEQUAL);gl.drawArrays(gl.TRIANGLES,0,T.length/3);
  gl.colorMask(true,true,true,true);gl.enable(gl.CULL_FACE);}
const LOOK_GLANCE={on:false};
/* ---- cameras ---- */
/* (2.16.5) No motion cues. 2.15 moved the head with the accelerations (a lag of the eye point and a nod
   with the load factor); every touch of the lever then moved the picture, which read as the aircraft itself
   nodding. Left out, like the rotor's vibration before: the picture moves only with the aircraft. */
function cameraUpdate(dt){
  const c=R3.cam,R=qmat(S.q),[phi,th,psi]=S.eul;
  // head: the mouse sets a target, the camera follows with a 120 ms lag; on release both return forward
  /* (2.13) Glances: Q and E held look out of the left and the right door window and down at the ground beside
     the skid (70° to the side, 25° down), the way a pilot glances while hovering; the stick stays in the hand
     (unlike C, which takes the mouse for the head). Released, the head comes back. Shift+Q and Shift+E are the
     tutor's quit and the engines. */
  const lk=DEV.look,K=DEV.keys,sh=K.ShiftLeft||K.ShiftRight,gl=sh||lk.on?0:(K.KeyE?1:0)-(K.KeyQ?1:0);LOOK_GLANCE.on=gl!==0;
  if(!lk.on){if(gl){lk.yawT=gl*70*DEG;lk.pitchT=-25*DEG;}else if(HT.on&&HT.ok&&cfg.view==='cockpit'){lk.yawT=HT.yaw;lk.pitchT=HT.pitch;}else{lk.yawT=(lk.yawT||0)*Math.max(0,1-dt*6);lk.pitchT=(lk.pitchT||0)*Math.max(0,1-dt*6);}}   // (2.13) the head by webcam (88_headtrack.js) after the glances
  const kf=Math.min(1,dt/0.12);lk.yaw+=((lk.yawT||0)-lk.yaw)*kf;lk.pitch+=((lk.pitchT||0)-lk.pitch)*kf;
  aprStep(dt);   // (2.12) the approach view's state, in every view (switching to the cockpit finds it current)
  if(cfg.view==='cockpit'){
    c.pos=vadd(S.pos,mrot(R,H.pilot.eye));
    // head yaw about the body vertical, then pitch; the line of sight looks down so that the bottom of the view sits ~36° below (the flight displays), see cockpitFov
    const fv=cockpitFov(R3.w/Math.max(1,R3.h),APR.k);
    const cy=Math.cos(lk.yaw),sy=Math.sin(lk.yaw),el=fv.down-lk.pitch,ce=Math.cos(el),se=Math.sin(el);
    c.f=mrot(R,[ce*cy,ce*sy,se]);c.u=mrot(R,[se*cy,se*sy,-ce]);c.fov=fv.v;c.gaze=fv.down;   // gaze: the line of sight's angle under the nose line (the panel's lift, 89_panel.js)
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
function cockpitFov(asp,k){const h0=clamp(cfg.fov||72,50,90)*DEG,vMax=62*DEG,vMin=46*DEG,hMax=85*DEG;k=k||0;
  let v=2*Math.atan(Math.tan(h0/2)/asp);
  if(v>vMax)v=vMax;
  else if(v<vMin){const h=Math.min(hMax,Math.max(h0,2*Math.atan(Math.tan(vMin/2)*asp)));v=2*Math.atan(Math.tan(h/2)/asp);}
  const down=clamp(36*DEG-v/2,5*DEG,14*DEG);
  if(k<=0)return {v,down};
  /* (2.13) without the chin windows (the default): the gaze only, 15° lower, the view as tall as ever and the
     panel where it is: 15° more of the ground ahead of the nose above the panel, the horizon still in the top
     fifth, nothing more to draw */
  if(!cfg.aprChin)return {v,down:down+15*DEG*k};
  // (2.12) the approach view with the chin windows: taller (up to 75°) and the gaze down to 25°, the bottom of the view 63° below the nose line; the top keeps 10° of sky
  const va=v+(75*DEG-v)*k,bot=36*DEG+27*DEG*k,da=Math.min(bot-va/2,va/2-10*DEG);
  return {v:va,down:lerp(down,clamp(da,5*DEG,26*DEG),k)};}
/* (2.15) HAPI, the helicopter approach path indicator (ICAO Annex 14 Vol. II): one light beside the pad that
   shows the pilot where he is against the approach slope by its colour, seen within 15° either side of the
   approach course. Above: flashing green; on the slope (45 minutes of arc): green; slightly below (15
   minutes): red; below: flashing red; the flashing at 2 Hz. Here: 6° (the phantom's approach), the course
   360° (from the south, where the approach exercises start), the light 14 m west of the pad's centre. */
const HAPI={pos:[-4,-14],h:0.45,slope:6,course:0,half:15,sig:''};
function hapiSignal(eye){const [n,e]=HAPI.pos,z=-(terrainH(n,e)+HAPI.h),dn=eye[0]-n,de=eye[1]-e,dh=Math.hypot(dn,de),up=z-eye[2];
  if(dh<30||dh>5000)return '';const brg=Math.atan2(de,dn)/DEG,off=Math.abs(((brg-(HAPI.course+180))%360+540)%360-180);if(off>HAPI.half)return '';
  const el=Math.atan2(up,dh)/DEG,s=HAPI.slope;return el>s+0.375?'above':el>=s-0.375?'on':el>=s-0.625?'low':'below';}
function hapiDraw(x){HAPI.sig='';if(!(cfg.view==='cockpit'||cfg.view==='chase')||!R3.cam.f)return;const c=R3.cam,sig=hapiSignal(c.pos);HAPI.sig=sig;if(!sig)return;
  const [n,e]=HAPI.pos,w=[n,e,-(terrainH(n,e)+HAPI.h)],d=vsub(w,c.pos);if(vdot(d,c.f)<=0)return;const p=project(w);if(!p)return;
  const flash=(sig==='above'||sig==='below')&&((R3.time||performance.now()/1000)*2%1)>0.5;if(flash)return;
  const col=sig==='above'||sig==='on'?'111,255,140':'255,70,50',dist=vlen(d),r=clamp(1400/dist,2.2,7);
  x.save();if(cfg.view==='cockpit'&&HUD.panelA>0.5){x.beginPath();x.rect(0,0,R3.w,HUD.panelTop);x.clip();}
  const g=x.createRadialGradient(p[0],p[1],0,p[0],p[1],r*4);g.addColorStop(0,`rgba(${col},0.9)`);g.addColorStop(0.25,`rgba(${col},0.45)`);g.addColorStop(1,`rgba(${col},0)`);
  x.fillStyle=g;x.beginPath();x.arc(p[0],p[1],r*4,0,7);x.fill();x.fillStyle='rgba(255,255,255,0.95)';x.beginPath();x.arc(p[0],p[1],r*0.45,0,7);x.fill();x.restore();}
function project(w){const v=R3.vp;const x=v[0]*w[0]+v[4]*w[1]+v[8]*w[2]+v[12],y=v[1]*w[0]+v[5]*w[1]+v[9]*w[2]+v[13],z=v[2]*w[0]+v[6]*w[1]+v[10]*w[2]+v[14],ww=v[3]*w[0]+v[7]*w[1]+v[11]*w[2]+v[15];
  if(ww<=0.01)return null;return [(x/ww*0.5+0.5)*R3.w,(0.5-y/ww*0.5)*R3.h];}
/* The hour and the air (2.9): the sun crosses from the east (06:00) through the south (13:00, 58° up) to the
   west (20:00), warmer and weaker low down; the sky's zenith, the horizon (the fog colour) and the ambient light
   follow it; the visibility sets the haze (k = 3 / visibility: 5 % contrast left at that distance), and in mist
   the sky greys too. The aircraft's planar shadow keeps the sun at 20° or more (lower it would stretch to the
   horizon). */
function skyState(){const t=clamp(cfg.tod===undefined?11:cfg.tod,5.5,20.5),x=clamp((t-6)/14,0,1),el=Math.max(2.5*DEG,58*DEG*Math.sin(Math.PI*x)),az=(90+180*x)*DEG;
  R3.sun=vnorm([Math.cos(el)*Math.cos(az),Math.cos(el)*Math.sin(az),-Math.sin(el)]);const es=Math.max(el,20*DEG);R3.shSun=vnorm([Math.cos(es)*Math.cos(az),Math.cos(es)*Math.sin(az),-Math.sin(es)]);
  const k=sm(1*DEG,30*DEG,el),L=(a,b)=>[0,1,2].map(i=>a[i]+(b[i]-a[i])*k),vis=clamp(cfg.vis||12,1,25),mist=sm(9,1.5,vis);
  R3.sunC=L([1.0,0.50,0.26],[1.0,0.97,0.92]).map(v=>v*(0.55+0.45*k)*(1-0.35*mist));R3.ambC=L([0.62,0.60,0.74],[0.97,0.99,1.03]).map(v=>v*(0.72+0.28*k));
  const fog=L([0.88,0.64,0.50],[0.74,0.80,0.88]);R3.fog=fog.map((v,i)=>lerp(v,[0.78,0.80,0.83][i]*(0.75+0.25*k),mist));
  R3.zen=L([0.20,0.27,0.52],[0.30,0.48,0.82]).map((v,i)=>lerp(v,R3.fog[i]*0.95,mist*0.85));R3.fogK=3/(vis*1000);}
function render(dt){
  const gl=R3.gl,cv=R3.canvas;R3.time+=dt;R3.dtF=dt;
  drsStep(dt);
  const lite=gfxLite();
  const W=cv.clientWidth|0,Hh=cv.clientHeight|0,pxr=gfxPixelRatio(W,Hh),bw=Math.max(1,Math.round(W*pxr)),bh=Math.max(1,Math.round(Hh*pxr));if(cv.width!==bw||cv.height!==bh){cv.width=bw;cv.height=bh;}
  R3.w=W;R3.h=Hh;R3.ph=bh;R3.pxr=pxr;gl.viewport(0,0,bw,bh);   // R3.w/h: page pixels (the HUD projects into them); the drawing buffer has pxr times as many each way
  R3.pr.gnd=lite?R3.pr.gndLite:R3.pr.gndFull;R3.pr.sky=lite?R3.pr.skyLite:R3.pr.skyFull;
  cameraUpdate(dt);
  const c=R3.cam,vpFull=R3.vp=m4mul(m4persp(c.fov,W/Hh,1.0,R3.far),m4view(c.pos,c.f,c.u));
  skyState();R3.windXY=[S.wind[0],S.wind[1]];
  const R=qmat(S.q),rt=H.rotor,st=S.rot,hubW=vadd(S.pos,mrot(R,rt.hub)),Rh=mmul(R,rt.Rbh),A={R,rt,st,hubW,Rh};
  const chin=chinOcclOn();   // (2.17.2) the chin windows: in this pass, the view drawn over the whole screen
  /* (2.9.2) in the cockpit the instrument panel covers the bottom of the view: nothing is drawn under it */
  const cut=!chin&&cfg.view==='cockpit'&&!cfg.panel3d&&HUD.panelA>0.99&&HUD.panelTop<Hh-40?Math.round((Hh-HUD.panelTop-20)*pxr):0;   // (2.12.2) also over a lifted panel: the chin windows under it are their own small passes (renderChin)
  if(cut>0){gl.enable(gl.SCISSOR_TEST);gl.scissor(0,cut,bw,bh-cut);   // (2.12.3) and the viewport with it: the projection cut down to the part above the panel (the same pixels), so what lies under the panel is not even sent
    gl.viewport(0,cut,bw,bh-cut);R3.vp=m4mul(subRectM(0,cut,bw,bh-cut,bw,bh),vpFull);}else gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(R3.fog[0],R3.fog[1],R3.fog[2],1);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
  if(chin)chinOccl(W,Hh,pxr,bw,bh);   // (2.17.2) the panel and the floor first, into the depth buffer only
  /* Nearest first, so the depth test turns hidden pixels away before they are shaded: the cockpit, the
     aircraft, buildings and trees, then the ground, then the sky into whatever is left. Then the shadow
     and everything transparent. (Until 2.2 the sky and the ground were shaded first, under everything.) */
  const cockpit=cfg.view==='cockpit'&&!!cfg.panel3d,early=cockpit&&R3.info&&R3.info.depthBits>=24;   // the 3D cockpit only on request (cfg.panel3d); since 2.6.1 the cockpit is the flat panel (89_panel.js)
  if(early){gl.depthRange(0,0.01);drawCockpit();gl.depthRange(0.01,1);}
  // the aircraft
  R3.spec=0.55;drawMesh(R3.pr.lit,R3.m.body,m4model(R,S.pos));   // from the cockpit the cabin's own faces are back faces (culled): only skids, nose and tail show
  drawMesh(R3.pr.lit,R3.m.fen,m4model(R,S.pos));
  drawMesh(R3.pr.lit,R3.m.hub,m4model(Rh,hubW));
  if(!(cfg.view==='cockpit'&&st.Om>15))for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;const a=Math.atan2(-rt.s*Math.sin(psi),-Math.cos(psi));   // from the seat a turning rotor is its blur (the disc below), not four blades caught at random
    drawMesh(R3.pr.lit,R3.m.blade,m4model(mmul(Rh,mmul(rotZ(a),rotY(st.beta[k]))),hubW));}
  R3.spec=0;
  R3.wash=ngWash();   // (2.9: before the trees, which bend in it)
  drawStatics(c.pos,lite,dt);   // scenery, trees, windsocks, turbines, cars
  R3.wash=ngWash();
  drawGround(c.pos,lite);
  gl.depthMask(false);gl.disable(gl.CULL_FACE);drawMesh(R3.pr.sky,R3.m.sky,m4model([1,0,0,0,1,0,0,0,1],c.pos));gl.depthMask(true);gl.enable(gl.CULL_FACE);   // the sky dome (centred on the camera, just inside the far plane) where nothing else is
  drawShadows(c.pos,lite,{R,rt,st,hubW,Rh});
  ngDraw(dt);   // downwash particles (after the sky, which would otherwise paint over them)
  lifeSmoke(dt);   // the chimneys' smoke (86_life.js)
  // rotor disc blur at the tip-path plane, Fenestron blur, the phantom, the tutor's target, the prediction
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  if(st.Om>15){let b0=0,bc=0,bs=0;for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;b0+=st.beta[k];bc+=st.beta[k]*Math.cos(psi);bs+=st.beta[k]*Math.sin(psi);}
    b0/=rt.N;bc*=2/rt.N;bs*=2/rt.N;
    // tip-path plane: up(x,y) = b0 - bc x - s bs y in hub axes -> rotY(-bc) then rotX(s bs)
    const Rt=mmul(rotY(-bc),rotX(rt.s*bs));
    const Md=m4model(mmul(Rh,Rt),vadd(hubW,mrot(Rh,[0,0,-2.5*Math.sin(b0)]))),ad=clamp((st.Om-15)/25,0,1)*(cfg.view==='cockpit'?0.13:0.22);   // from the seat, looking up through it, fainter (2.9)
    drawMesh(R3.pr.lit,R3.m.disc,Md,ad);drawMesh(R3.pr.lit,R3.m.discRim,Md,ad*0.5);
    drawMesh(R3.pr.lit,R3.m.fenBlur,m4model(R,S.pos),clamp((st.Om-15)/25,0,1)*0.35);}
  // (until 1.9 a pale ring stood for the downwash; ground ripples and particles show it now)
  if(UI.phantom&&UI.phantom.S){const P=UI.phantom.S;drawMesh(R3.pr.lit,R3.m.phantom,m4model(qmat(P.q),P.pos),0.45);}
  if(TUTOR.target){const [n,e]=TUTOR.target;const pulse=0.25+0.15*Math.sin(R3.time*3);drawMesh(R3.pr.lit,R3.m.column,m4model(UPX,[n,e,-terrainH(n,e)]),pulse);}
  guideGL();   // click to fly: the target's column (92_coach.js)
  if(cfg.predict&&PRED.res){predDisplay(dt);predGL();}   // the predicted path anchored in the world and eased, the ghost (87_predict.js)
  gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
  if(early){gl.depthRange(0,0.01);drawCockpitGlass();}
  else if(cockpit){gl.clear(gl.DEPTH_BUFFER_BIT);drawCockpit();drawCockpitGlass();}
  gl.depthRange(0,1);gl.disable(gl.SCISSOR_TEST);R3.vp=vpFull;gl.viewport(0,0,bw,bh);   // the full view's projection again: the HUD projects with it
}
