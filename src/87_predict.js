/* ═══════════════ MOTION PREDICTOR: where everything done so far takes the aircraft ═══════════════
   A helicopter answers late: a stick input tilts the rotor, the tilt
   rotates the fuselage, the attitude accelerates the aircraft, and the
   speed it has keeps carrying it. The predictor shows the result of all
   of that before it happens: from the present state it flies the real
   model ahead (the same physics, the stability augmentation and the
   engaged autopilot modes, with the pilot's controls held where they
   are now, steady wind without turbulence) and the view and the HUD show
   the path.

   How far ahead: the prediction is exact for controls held still, and
   the pilot does not hold them still. In the hover 1 % of stick moves the
   predicted spot by 0.5 m after 6 s, 1.2 m after 10 s and 4-5 m after
   20 s (measured on the model), and the hover needs metres; beyond ~8 s
   the path mostly shows corrections not yet made, and a long path would
   shrink the plan view's scale past the first metres. In forward flight
   the same 1 % makes 2.5-4 m after 20 s on a kilometre of track, and 6 s
   are only 320 m at 100 kt. So the horizon grows with the ground speed,
   from 6 s below 15 kt to 30 s from ~70 kt (cfg.predictT 'auto'), or is
   set in the settings.

   What is drawn (2.5, the band redrawn in 2.5.1, anchored in the world and eased in 2.5.2):
   - in the view (WebGL, depth-tested, so the path goes behind buildings
     and hills): a band where the skids will run, its bright edges the
     skids' tracks, tilted with the aircraft (it banks into a turn), an
     arrow at every whole second of the clock, fading with time; its
     shadow on the ground with a line down every second while low; at
     speed, gates to fly through every 3 s of the clock; a ghost of
     the aircraft 6 s ahead in the attitude it will have then (it fades
     out while it would sit inside the aircraft itself) with a ring on the
     ground below it; where the skids will touch the ground, their
     footprint in the colour of the sink rate (green below 1.2 m/s, amber,
     red from the hard-landing limit), and a red cross where the model
     crashes;
   - in the HUD: the plan view (nose up: the past track, the predicted
     track fading with time, the ghost's outline at 6 s, the touchdown,
     the hover spot and the ground speed) and next to it the height
     profile over the same seconds (skid height near the ground, the
     change of height higher up, the ALT target when held).

   It runs in a Web Worker on its own copy of the physics modules (the
   page carries them a second time as text, id engineSrc) at 120 Hz with
   the control laws at 60 Hz, which matches the 360 Hz flight within a few
   centimetres over five seconds at a third of the cost; 30 s take 60-120
   ms there (headless Chromium, two cores). A new prediction starts when
   the last one is back, at most 20 a second. Where a page may not start
   a worker, the same prediction runs on the main thread, in slices of 20
   steps per frame, over at most four seconds. */
const PRED={w:null,mode:'',busy:false,res:null,ms:0,T:6,Tauto:6,err:'',sentAt:0,main:null,past:[],gen:0};   // gen: results of an older generation (before a reset or a synchronous prediction) are dropped
const PRED_PS=8;      // floats per recorded point: t, n, e, d, psi, phi, theta, skid height above the ground
const PRED_GHOST=6;   // the ghost shows the aircraft this many seconds ahead (or at the end of a shorter prediction)
const PRED_GLUE=`
const PRED_PS=8;
function predRun(m){   // m: snapshot; returns the recorded path every 0.1 s, the first touchdown and a crash
  S=m.S;Object.assign(SAS,m.SAS);Object.assign(TRIM,m.TRIM);Object.assign(AP_MAIN,m.AP);Object.assign(AFCS,m.AFCS);Object.assign(cfg,m.cfg);
  Object.assign(WIND,m.WIND);WIND.turb=0;WIND.gust=0;Object.assign(IN,m.IN);
  const N=Math.round(m.T*60),out=new Float32Array((Math.floor(N/6)+2)*PRED_PS);let j=0,touch=null,crash=null;const tw=S.touch&&S.touch.t;
  const rec=()=>{out[j++]=S.t-m.t0;out[j++]=S.pos[0];out[j++]=S.pos[1];out[j++]=S.pos[2];out[j++]=S.eul[2];out[j++]=S.eul[0];out[j++]=S.eul[1];out[j++]=S.hAGL;};
  rec();
  for(let i=1;i<=N;i++){const o=sasApply(1/60,m.raw);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;
    if(m.demo||m.locks){const a=apStep(1/60);for(const k of ['col','lon','lat','ped'])if(m.demo||m.locks[k])IN[k]=a[k];}
    else if(afcsAny())afcsApply(1/60);
    step(1/120);step(1/120);
    if(!touch&&S.touch&&S.touch.t&&S.touch.t!==tw)touch={t:S.touch.t-m.t0,vs:S.touch.vs,n:S.pos[0],e:S.pos[1],psi:S.eul[2]};
    if(i%6===0)rec();
    if(S.crash){if(i%6)rec();crash={t:S.t-m.t0,why:S.crash,n:S.pos[0],e:S.pos[1],d:S.pos[2]};break;}}
  return {t0:m.t0,T:m.T,gen:m.gen,n:j/PRED_PS,pts:out,touch,crash};}
if(typeof self!=='undefined'&&typeof document==='undefined')self.onmessage=function(e){const t0=performance.now();
  try{const r=predRun(e.data);r.ms=performance.now()-t0;postMessage(r,[r.pts.buffer]);}catch(err){postMessage({err:String(err&&err.message||err)});}};`;
function predInit(){
  const src=typeof document!=='undefined'&&document.getElementById('engineSrc');
  if(!src||typeof Worker==='undefined'||typeof Blob==='undefined'){PRED.mode='main';return;}
  try{const url=URL.createObjectURL(new Blob([src.textContent+'\n'+PRED_GLUE],{type:'text/javascript'}));
    PRED.w=new Worker(url);PRED.mode='worker';
    PRED.w.onmessage=e=>{const d=e.data;PRED.busy=false;if(d.err){PRED.err=d.err;PRED.w.terminate();PRED.w=null;PRED.mode='main';return;}if(d.gen!==PRED.gen)return;PRED.res=d;PRED.ms=d.ms;};
    PRED.w.onerror=e=>{PRED.err=String(e.message||'worker error');PRED.busy=false;try{PRED.w.terminate();}catch(_){}PRED.w=null;PRED.mode='main';};}
  catch(e){PRED.err=String(e);PRED.w=null;PRED.mode='main';}}
/* the horizon: set (cfg.predictT in seconds) or with the ground speed, 6 s below 15 kt to 30 s from ~70 kt,
   in whole seconds and changed only by 2 s or more (the path should not flicker in length) */
function predHorizon(){const v=cfg.predictT;if(v!==undefined&&v!=='auto'){const n=parseFloat(v);if(n>0)return clamp(n,2,30);}
  const vN=mrot(qmat(S.q),S.vb),gs=Math.hypot(vN[0],vN[1])/KT,T=Math.round(6+24*sm(15,70,gs));
  if(Math.abs(T-PRED.Tauto)>=2||T<=6||T>=30)PRED.Tauto=T;return PRED.Tauto;}
function predSnapshot(T){const locks=TUTOR.on?{col:!!TUTOR.lockCol,lon:!!TUTOR.lockLon,lat:!!TUTOR.lockLat,ped:!!TUTOR.lockPed}:null;
  return {S,SAS:{...SAS},TRIM:{...TRIM},AP:JSON.parse(JSON.stringify(AP_MAIN)),AFCS:JSON.parse(JSON.stringify(AFCS)),
    cfg:JSON.parse(JSON.stringify(cfg)),WIND:{...WIND},IN:{col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped},raw:{...IN.raw},
    t0:S.t,T,gen:PRED.gen,demo:!!UI.apDemo,locks:locks&&(locks.col||locks.lon||locks.lat||locks.ped)?locks:null};}
/* Main-thread fallback: the prediction advances K control steps per call on its own state, the live
   globals swapped out and back around it. */
function predMainSlice(K){
  const P=PRED.main;if(!P)return;
  const live={S,SAS:{...SAS},TRIM:{...TRIM},AP:JSON.parse(JSON.stringify(AP_MAIN)),AFCS:JSON.parse(JSON.stringify(AFCS)),cfg:{...cfg},WIND:{...WIND},IN:{col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped}};
  const rec=()=>P.rec.push(S.t-P.m.t0,S.pos[0],S.pos[1],S.pos[2],S.eul[2],S.eul[0],S.eul[1],S.hAGL);
  try{
    S=P.m.S;Object.assign(SAS,P.st.SAS);Object.assign(TRIM,P.st.TRIM);Object.assign(AP_MAIN,P.st.AP);Object.assign(AFCS,P.st.AFCS);Object.assign(cfg,P.m.cfg);Object.assign(WIND,P.m.WIND);WIND.turb=0;WIND.gust=0;Object.assign(IN,P.st.IN);
    const N=Math.round(P.m.T*60);
    for(let k=0;k<K&&P.i<N;k++){P.i++;const o=sasApply(1/60,P.m.raw);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;
      if(P.m.demo||P.m.locks){const a=apStep(1/60);for(const c of ['col','lon','lat','ped'])if(P.m.demo||P.m.locks[c])IN[c]=a[c];}else if(afcsAny())afcsApply(1/60);
      step(1/120);step(1/120);
      if(!P.touch&&S.touch&&S.touch.t&&S.touch.t!==P.tw)P.touch={t:S.touch.t-P.m.t0,vs:S.touch.vs,n:S.pos[0],e:S.pos[1],psi:S.eul[2]};
      if(P.i%6===0)rec();
      if(S.crash){if(P.i%6)rec();P.crash={t:S.t-P.m.t0,why:S.crash,n:S.pos[0],e:S.pos[1],d:S.pos[2]};break;}}
    P.st={SAS:{...SAS},TRIM:{...TRIM},AP:JSON.parse(JSON.stringify(AP_MAIN)),AFCS:JSON.parse(JSON.stringify(AFCS)),IN:{col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped}};
    if(P.i>=N||S.crash){PRED.res={t0:P.m.t0,T:P.m.T,n:P.rec.length/PRED_PS,pts:Float32Array.from(P.rec),touch:P.touch,crash:P.crash};PRED.main=null;PRED.busy=false;}
  }finally{S=live.S;Object.assign(SAS,live.SAS);Object.assign(TRIM,live.TRIM);for(const k in AP_MAIN)if(!(k in live.AP))delete AP_MAIN[k];Object.assign(AP_MAIN,live.AP);
    Object.assign(AFCS,live.AFCS);Object.assign(cfg,live.cfg);Object.assign(WIND,live.WIND);Object.assign(IN,live.IN);}}
function predStartMain(T){const m=predSnapshot(T);m.S=structuredClone(S);
  PRED.main={m,i:0,rec:[0,S.pos[0],S.pos[1],S.pos[2],S.eul[2],S.eul[0],S.eul[1],S.hAGL],st:{SAS:m.SAS,TRIM:m.TRIM,AP:m.AP,AFCS:m.AFCS,IN:m.IN},touch:null,crash:null,tw:S.touch&&S.touch.t};PRED.busy=true;}
/* the track flown so far (the plan view draws the last 12 s of it) */
function predPast(){const P=PRED.past;let l=P[P.length-1];
  if(l&&(S.t<l.t||Math.hypot(S.pos[0]-l.n,S.pos[1]-l.e)>60)){P.length=0;l=null;}   // a reset
  if(!l||S.t-l.t>=0.1)P.push({t:S.t,n:S.pos[0],e:S.pos[1],d:S.pos[2]});
  while(P.length&&S.t-P[0].t>12)P.shift();}
/* Called once per frame after the controls are set. sync: run a whole prediction now, on this thread
   (screenshots and tests). */
function predStep(sync){
  if(!cfg.predict||REPLAY.on||!S||S.crash){PRED.res=null;return;}
  if(!PRED.mode)predInit();
  predPast();
  const T=PRED.T=predHorizon();
  if(sync){PRED.gen++;predStartMain(T);while(PRED.main)predMainSlice(1e9);return;}
  if(PRED.mode==='worker'&&PRED.w){const now=performance.now();
    if(PRED.busy&&now-PRED.sentAt<2000)return;
    if(now-PRED.sentAt<50)return;   // at most 20 predictions a second
    try{PRED.w.postMessage(predSnapshot(T));PRED.busy=true;PRED.sentAt=now;}catch(e){PRED.err=String(e);PRED.mode='main';try{PRED.w.terminate();}catch(_){}PRED.w=null;PRED.busy=false;}
    return;}
  if(!PRED.main)predStartMain(Math.min(T,4));   // main thread: at most four seconds, a slice per frame
  predMainSlice(10);}
/* the predicted state t seconds after now (interpolated; the prediction started a little earlier) */
function predAt(t){const r=PRED.res;if(!r||r.n<2)return null;const p=r.pts,K=PRED_PS,tt=t+(S.t-r.t0);
  for(let i=1;i<r.n;i++){const a=(i-1)*K,b=i*K;if(p[b]>=tt){const k=clamp((tt-p[a])/Math.max(1e-6,p[b]-p[a]),0,1);const L=(o)=>p[a+o]+(p[b+o]-p[a+o])*k;
    return {t,n:L(1),e:L(2),d:L(3),psi:p[a+4]+wrapPi(p[b+4]-p[a+4])*k,phi:L(5),th:L(6),h:L(7)};}}
  return null;}
/* the path from now to the end of the prediction, every `every` records (0.1 s each) */
function predPath(every){const r=PRED.res;if(!r)return [];const p=r.pts,K=PRED_PS,dt0=S.t-r.t0,out=[],ev=every||1;
  for(let i=0;i<r.n;i++){const t=p[i*K]-dt0;if(t<0)continue;if(out.length&&(i%ev)&&i!==r.n-1)continue;
    out.push({t,n:p[i*K+1],e:p[i*K+2],d:p[i*K+3],psi:p[i*K+4],phi:p[i*K+5],th:p[i*K+6],h:p[i*K+7]});}
  return out;}
function predEnd(){const r=PRED.res;return r&&r.n>1?r.pts[(r.n-1)*PRED_PS]-(S.t-r.t0):0;}
/* (2.13.2) The vertical speed 6 s ahead, controls held: the lead the collective needs. The rotor
   answers the lever at once (the FLI moves with it, the seat feels 0.025 g per 1 % of lever) but the
   vertical speed settles with a time constant of about 4 s in the hover; watching the vertical speed
   alone, the hand keeps adding until it shows, and then it is too much (the classic chase). A pilot
   has the seat of his pants and a power setting he knows; the screen has neither, so the VSI and the
   HUD carry a mark where the vertical speed will be (with a touchdown predicted before then, the sink
   just before it). Smoothed over 0.15 s; null without a prediction. */
function predVS(){const e=predEnd(),tc=predEvents().touch;if(e<1.2)return null;
  const t=tc&&tc.t<6.5?tc.t-0.3:Math.min(6,e-0.3);if(t<0.3)return null;   // a touchdown before then: the sink just before it (the footprint's colour), not the skids standing on the ground
  const a=predAt(t-0.25),b=predAt(t+0.25);return a&&b?-(b.d-a.d)/0.5:null;}
function predTrendStep(dt){const v=cfg.predict&&!REPLAY.on?predVS():null;PRED.vsTr=v===null?null:(PRED.vsTr==null?v:PRED.vsTr+(v-PRED.vsTr)*Math.min(1,dt/0.4));}   // (2.16.4) 0.4 s (was 0.15: it jumped with every notch)
/* the first touchdown and a crash, in seconds from now (null when none or already past) */
function predEvents(){const r=PRED.res,o={touch:null,crash:null};if(!r)return o;const dt0=S.t-r.t0;
  if(r.touch&&r.touch.t-dt0>-0.1)o.touch={...r.touch,t:r.touch.t-dt0};
  if(r.crash&&r.crash.t-dt0>-0.1)o.crash={...r.crash,t:r.crash.t-dt0};
  return o;}
/* ---- what is drawn: the prediction anchored in the world, and eased (2.5.2) ----
   Until 2.5.1 the marks hung at fixed times from now (1 s, 2 s … ahead): they travelled with the
   aircraft and jumped at every new prediction, 10-20 times a second (6 cm two seconds ahead, 30 cm four
   seconds ahead with the stick moving, ~10 px from the chase camera). Now every sample of the path
   belongs to a moment (where the aircraft will be at 12:00:03.2, say), so it stays where it is in the
   world while the aircraft flies towards it, as markings on a road do; a new prediction moves it over
   ~0.15 s instead of at once; samples appear softly at the far end and are used up at the aircraft. The
   band, the arrows, the gates, the ghost, the plan view and the profile are all drawn from these. */
const PD={gen:-1,dt:0.1,s:new Map(),path:[],T:0,touch:null,crash:null};
const PD_TAU=0.15;
function predDisplay(dtw){
  const r=PRED.res;if(!r||!S){PD.s.clear();PD.path=[];PD.T=0;PD.touch=PD.crash=null;return;}
  const Tend=predEnd(),dt=Tend>12?0.3:Tend>8?0.2:0.1,fresh=PD.gen!==PRED.gen||dt!==PD.dt||!PD.s.size;
  if(fresh){PD.s.clear();PD.gen=PRED.gen;PD.dt=dt;}
  const a=fresh?1:1-Math.exp(-Math.max(0,dtw||0)/PD_TAU),now=S.t,kA=Math.floor(now/dt+1e-9)+1,kB=Math.floor((now+Tend)/dt+1e-9);
  for(const k of PD.s.keys())if(k<kA||k>kB+Math.round(1/dt))PD.s.delete(k);   // passed, or well beyond a stale prediction's end
  const p=r.pts,K=PRED_PS;let i=1;
  for(let k=kA;k<=kB;k++){const tt=k*dt-r.t0;while(i<r.n-1&&p[i*K]<tt)i++;
    const a0=(i-1)*K,b0=i*K,u=clamp((tt-p[a0])/Math.max(1e-6,p[b0]-p[a0]),0,1),L=o=>p[a0+o]+(p[b0+o]-p[a0+o])*u;
    const q={n:L(1),e:L(2),d:L(3),psi:p[a0+4]+wrapPi(p[b0+4]-p[a0+4])*u,phi:L(5),th:L(6),h:L(7)},o=PD.s.get(k);
    if(!o){q.born=fresh?-1e9:now;PD.s.set(k,q);continue;}
    o.n+=(q.n-o.n)*a;o.e+=(q.e-o.e)*a;o.d+=(q.d-o.d)*a;o.psi=wrapPi(o.psi+wrapPi(q.psi-o.psi)*a);o.phi+=(q.phi-o.phi)*a;o.th+=(q.th-o.th)*a;o.h+=(q.h-o.h)*a;}
  // the path drawn: from the aircraft as it is now through the eased samples
  PD.path=[{t:0,n:S.pos[0],e:S.pos[1],d:S.pos[2],psi:S.eul[2],phi:S.eul[0],th:S.eul[1],h:S.hAGL,fa:1}];
  for(const k of [...PD.s.keys()].sort((x,y)=>x-y)){const o=PD.s.get(k),t=k*dt-now;if(t>0.02)PD.path.push({t,n:o.n,e:o.e,d:o.d,psi:o.psi,phi:o.phi,th:o.th,h:o.h,fa:sm(0,0.5,now-o.born)});}
  PD.T=PD.path.length>1?PD.path[PD.path.length-1].t:0;
  const ev=predEvents();PD.touch=predEase(PD.touch,ev.touch,a,fresh);PD.crash=predEase(PD.crash,ev.crash,a,fresh);}
function predEase(o,q,a,fresh){if(!q)return null;if(!o||fresh)return {...q};const r={...q,n:o.n+(q.n-o.n)*a,e:o.e+(q.e-o.e)*a};
  if(q.psi!==undefined&&o.psi!==undefined)r.psi=wrapPi(o.psi+wrapPi(q.psi-o.psi)*a);if(q.d!==undefined&&o.d!==undefined)r.d=o.d+(q.d-o.d)*a;return r;}
/* the drawn path at t seconds from now (interpolated) */
function dispAt(t){const P=PD.path;if(P.length<2||t<0||t>PD.T+1e-6)return null;
  for(let i=1;i<P.length;i++)if(P[i].t>=t){const a=P[i-1],b=P[i],u=clamp((t-a.t)/Math.max(1e-6,b.t-a.t),0,1),L=f=>a[f]+(b[f]-a[f])*u;
    return {t,n:L('n'),e:L('e'),d:L('d'),psi:wrapPi(a.psi+wrapPi(b.psi-a.psi)*u),phi:L('phi'),th:L('th'),h:L('h'),fa:L('fa')};}
  return null;}
/* the marks belong to moments: the whole seconds of the clock (every `step` s) between `t0` and the end */
function dispMarks(step,t0){const out=[];if(PD.T<=0)return out;for(let m=Math.ceil((S.t+t0)/step)*step;m<=S.t+PD.T+1e-6;m+=step){const t=m-S.t,q=dispAt(t);if(q)out.push({m:Math.round(m),t,q});}return out;}
/* the ghost: the drawn state at 6 s (or the end), and how visible it is. Close to the aircraft itself
   (in position and attitude) it would only double the picture: it fades out below ~2 m. */
function predGhost(){if(PD.T<1)return null;const t=Math.min(PRED_GHOST,PD.T),q=dispAt(t);if(!q)return null;
  const sep=Math.hypot(q.n-S.pos[0],q.e-S.pos[1],q.d-S.pos[2])+3*(Math.abs(wrapPi(q.psi-S.eul[2]))+Math.abs(q.phi-S.eul[0])+Math.abs(q.th-S.eul[1]));
  const as=sm(1.5,5,sep);let a=as;
  if(cfg.view==='cockpit'){const c=R3.cam.pos;a*=sm(14,24,Math.hypot(q.n-c[0],q.e-c[1],q.d-c[2]));}   // from the seat only once it is well ahead
  return {q,t,a,as};}   // as: without the cockpit's distance (for the ring on the ground below it)
function predTouchCol(vs){return vs<1.2?HUD_COL.ok:vs<H.gear.hardVs?HUD_COL.amber:HUD_COL.hot;}
function hexRgb(h){const v=parseInt(h.slice(1),16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];}

/* ---- in the view (WebGL), called from render() in the transparent pass ---- */
const VS_PRED=`attribute vec3 aP;attribute vec4 aC;uniform mat4 uMVP;varying vec4 vC;varying vec3 vW;void main(){vC=aC;vW=aP;gl_Position=uMVP*vec4(aP,1.0);}`;
const FS_PRED=`${GLSL_PREC}varying vec4 vC;varying vec3 vW;uniform vec3 uCam;uniform vec3 uFog;void main(){float f=1.0-exp(-length(vW-uCam)*0.00036);gl_FragColor=vec4(mix(vC.rgb,uFog,f*0.5),vC.a*(1.0-0.5*f));}`;
/* the ghost: the aircraft's own meshes, see-through, bright where the surface turns away from the eye */
const FS_GHOST=`${GLSL_PREC}varying vec3 vN;varying vec3 vC;varying vec3 vW;uniform vec3 uCam;uniform float uAlpha;uniform vec3 uTint;
void main(){vec3 n=normalize(vN),v=normalize(uCam-vW);float r=1.0-abs(dot(n,v)),far=smoothstep(40.0,250.0,length(uCam-vW));gl_FragColor=vec4(uTint*(0.72+0.45*r),uAlpha*(mix(0.10,0.45,far)+0.90*r*r*r));}`;   // far away it is a few pixels: more body, less rim
const PGL={buf:null,a:new Float32Array(65536),n:0};
function pgPush(p,c,al){let a=PGL.a;if(PGL.n+7>a.length){const b=new Float32Array(a.length*2);b.set(a);PGL.a=a=b;}const i=PGL.n;a[i]=p[0];a[i+1]=p[1];a[i+2]=p[2];a[i+3]=c[0];a[i+4]=c[1];a[i+5]=c[2];a[i+6]=al;PGL.n+=7;}
function pgQuad(A,B,C,D,cA,aA,cB,aB,cC,aC,cD,aD){pgPush(A,cA,aA);pgPush(B,cB,aB);pgPush(C,cC,aC);pgPush(A,cA,aA);pgPush(C,cC,aC);pgPush(D,cD,aD);}
/* metres per page pixel at a point (its depth along the line of sight) */
function pgPx(P){const c=R3.cam;const z=Math.max(0.5,vdot(vsub(P,c.pos),c.f));return z*2*Math.tan(c.fov/2)/Math.max(1,R3.h);}
/* a line that faces the eye, w pixels wide at each end */
function pgLine(A,B,wa,wb,col,aa,ab){const c=R3.cam.pos,d=vsub(B,A),m=vsub(vscl(vadd(A,B),0.5),c);let s=vcross(d,m);const L=vlen(s);if(L<1e-9)return;s=vscl(s,1/L);
  const ka=wa*pgPx(A)/2,kb=wb*pgPx(B)/2;pgQuad(vsub(A,vscl(s,ka)),vadd(A,vscl(s,ka)),vadd(B,vscl(s,kb)),vsub(B,vscl(s,kb)),col,aa,col,aa,col,ab,col,ab);}
/* a flat strip on the ground from A to B, w metres wide (at least px pixels) */
function pgFlat(A,B,w,px,col,al){const d=vsub(B,A),L=Math.hypot(d[0],d[1]);if(L<1e-6)return;const s=[-d[1]/L,d[0]/L,0];
  const ka=Math.max(w,px*pgPx(A))/2,kb=Math.max(w,px*pgPx(B))/2;pgQuad(vsub(A,vscl(s,ka)),vadd(A,vscl(s,ka)),vadd(B,vscl(s,kb)),vsub(B,vscl(s,kb)),col,al,col,al,col,al,col,al);}
function pgGround(n,e,lift){const c=R3.cam.pos;return [n,e,-terrainH(n,e)-(lift||0.08)-0.002*Math.hypot(n-c[0],e-c[1])];}
function predGL(){
  const gl=R3.gl;if(!gl||!cfg.predict||!PRED.res)return;
  if(!R3.pr.pred){R3.pr.pred=glProg(gl,VS_PRED,FS_PRED);R3.pr.ghost=glProg(gl,VS_LIT,FS_GHOST);PGL.buf=gl.createBuffer();}
  const P=PD.path,T=Math.max(1,PD.T);if(P.length<2)return;
  const cam=R3.cam,WHITE=[1,1,1],DARK=[0.04,0.05,0.04],cockpit=cfg.view==='cockpit',SKID=1.2;
  PGL.n=0;
  /* The band runs where the skids will run: 1.2 m below the CG along the aircraft's own vertical, its two
     rails 1.1 m either side (the skid track), so where it meets the ground the skids meet it. It lies in the
     aircraft's lateral plane (body z × path: it banks into a turn); seen edge-on it turns towards the eye,
     so it never thins to a line. At least 12 px wide. White now, cooler and fainter towards the end; in the
     last 1.5 s before a touchdown it takes the touchdown's colour. */
  const skid=q=>{const R=qmat(qfromEuler(q.phi,q.th,q.psi));return vadd([q.n,q.e,q.d],vscl([R[2],R[5],R[8]],SKID));};
  const fadeT=(t,pt)=>{let f=1-0.55*t/T;if(cockpit)f*=sm(30,90,vlen(vsub(pt,cam.pos)));return f;};   // from the seat it starts out where the flight path marker is: nearer it would hang down across the view
  const n=P.length,pos=P.map(skid),side=[],tan=[],hw=[],fade=[],low=[],col=[],ev={touch:PD.touch,crash:PD.crash},tdCol=ev.touch&&!ev.crash?hexRgb(predTouchCol(ev.touch.vs)):null;
  const across=(q,t,pt)=>{const R=qmat(qfromEuler(q.phi,q.th,q.psi)),yb=[R[1],R[4],R[7]],zb=[R[2],R[5],R[8]];
    let c=vcross(zb,t);const cl=vlen(c);c=cl>1e-6?vscl(c,1/cl):yb;if(vdot(c,yb)<0)c=vscl(c,-1);
    const sb=vnorm(vadd(vscl(c,sm(0.2,0.5,cl)),vscl(yb,1-sm(0.2,0.5,cl))));
    const vw=vnorm(vsub(pt,cam.pos));let sc=vcross(t,vw);const scl=vlen(sc);sc=scl>1e-6?vscl(sc,1/scl):sb;if(vdot(sc,sb)<0)sc=vscl(sc,-1);
    const w=1-sm(0.12,0.42,Math.abs(vdot(vcross(t,sb),vw)));return vnorm(vadd(vscl(sb,1-w),vscl(sc,w)));};
  for(let i=0;i<n;i++){const q=P[i];
    let t=vsub(pos[Math.min(n-1,i+1)],pos[Math.max(0,i-1)]);const tl=vlen(t);if(tl>0.02)t=vscl(t,1/tl);else{const R=qmat(qfromEuler(q.phi,q.th,q.psi));t=i?tan[i-1]:[R[0],R[3],R[6]];}tan.push(t);
    let s=across(q,t,pos[i]);if(i&&vdot(s,side[i-1])<0)s=vscl(s,-1);side.push(s);
    hw.push(Math.max(1.1,6*pgPx(pos[i])));fade.push(fadeT(q.t,pos[i])*q.fa);low.push(1-sm(25,60,q.h));
    let cc=[1-0.3*q.t/T,1-0.1*q.t/T,1];if(tdCol){const k=sm(ev.touch.t-1.5,ev.touch.t-0.3,q.t);cc=[lerp(cc[0],tdCol[0],k),lerp(cc[1],tdCol[1],k),lerp(cc[2],tdCol[2],k)];}col.push(cc);}
  // its shadow on the ground while low (dark, soft, a light thread along its middle: readable on the dark pad and on grass)
  const gnd=P.map(q=>pgGround(q.n,q.e));
  const gf=P.map((q,i)=>low[i]*(1-0.55*q.t/T)*q.fa*(cockpit?sm(4,10,vlen(vsub(gnd[i],cam.pos))):1));   // on the ground it may come close to the seat: it lies there like paint
  for(let i=0;i+1<n;i++){const l0=gf[i],l1=gf[i+1];if(l0+l1<0.02)continue;
    const d=vsub(gnd[i+1],gnd[i]),L=Math.hypot(d[0],d[1]);if(L>1e-4){const sx=[-d[1]/L,d[0]/L,0],k0=hw[i]*0.9,k1=hw[i+1]*0.9;
      pgQuad(vsub(gnd[i],vscl(sx,k0)),vsub(gnd[i+1],vscl(sx,k1)),gnd[i+1],gnd[i],DARK,0,DARK,0,DARK,0.3*l1,DARK,0.3*l0);
      pgQuad(gnd[i],gnd[i+1],vadd(gnd[i+1],vscl(sx,k1)),vadd(gnd[i],vscl(sx,k0)),DARK,0.3*l0,DARK,0.3*l1,DARK,0,DARK,0);}
    pgLine(gnd[i],gnd[i+1],1.4,1.4,WHITE,0.55*l0,0.55*l1);}
  // the band: across it a soft glow, the bright rail (the skid's path), a light fill, a slightly brighter middle
  const U=[-1.2,-1,-0.8,0,0.8,1,1.2],A=[0,0.95,0.17,0.27,0.17,0.95,0];
  for(let i=0;i+1<n;i++){const at=(j,u)=>vadd(pos[j],vscl(side[j],u*hw[j]));
    for(let k=0;k+1<U.length;k++)pgQuad(at(i,U[k]),at(i+1,U[k]),at(i+1,U[k+1]),at(i,U[k+1]),col[i],A[k]*fade[i],col[i+1],A[k]*fade[i+1],col[i+1],A[k+1]*fade[i+1],col[i],A[k+1]*fade[i]);}
  /* an arrow on the band at every whole second of the clock (larger every five): it stays where it is while
     the aircraft flies towards it, and fades out just before the aircraft reaches it; their spacing shows
     how fast. The line down to the ground below it while low. */
  const mark=t=>{const q=dispAt(t),q2=dispAt(Math.min(PD.T,t+0.15)),q1=dispAt(Math.max(0,t-0.15));if(!q||!q1||!q2)return null;
    const p=skid(q),d=vsub(skid(q2),skid(q1)),dl=vlen(d);return {q,p,tn:dl>1e-3?vscl(d,1/dl):null};};
  let prevP=null;
  for(const mk of dispMarks(1,0.25)){const a=mark(mk.t);if(!a)continue;const major=mk.m%5===0;
    const f=fadeT(mk.t,a.p)*mk.q.fa*sm(0.25,0.8,mk.t),hwk=Math.max(1.1,6*pgPx(a.p));
    const spaced=!prevP||vlen(vsub(a.p,prevP))>0.6*hwk;prevP=a.p;   // where they would overlap (the hover), none
    if(a.tn&&spaced&&f>0.02){const s=across(a.q,a.tn,a.p),L=(major?0.75:0.55)*hwk,W=(major?0.8:0.62)*hwk,tip=vadd(a.p,vscl(a.tn,L*0.5)),bk=vsub(a.p,vscl(a.tn,L*0.5)),px=major?3.5:2.5,cc=col[Math.min(n-1,Math.max(0,P.findIndex(p=>p.t>=mk.t)))];
      pgLine(vadd(bk,vscl(s,W)),tip,px,px,cc,0.9*f,0.9*f);pgLine(vsub(bk,vscl(s,W)),tip,px,px,cc,0.9*f,0.9*f);}
    const lo=(1-sm(25,60,a.q.h))*f;if(lo>0.02)pgLine(a.p,pgGround(a.q.n,a.q.e),1.3,1.3,WHITE,0.38*lo,0.2*lo);}
  /* at speed, gates to fly through at every third second of the clock: corner marks of a frame 12 m wide
     from just under the skids to above the rotor, square to the path and banked with the aircraft. Seen
     from the seat, where the band runs straight ahead and shrinks to a point, they show where the aircraft
     will be and how it will be banked. They stay put as the aircraft approaches and fade as it reaches them;
     in the hover (closer than 8-14 m apart) there are none. */
  for(const mk of dispMarks(3,0.4)){const q=mk.q,c=[q.n,q.e,q.d],qb=dispAt(Math.max(0,mk.t-3));if(!qb)continue;
    const apart=sm(8,14,Math.hypot(q.n-qb.n,q.e-qb.e,q.d-qb.d))*(mk.t<3?sm(8,14,Math.hypot(q.n-S.pos[0],q.e-S.pos[1])*3/Math.max(0.5,mk.t)):1);
    const f=fadeT(mk.t,c)*q.fa*apart*(cockpit?sm(0.7,1.6,mk.t):sm(0.4,0.9,mk.t));if(f<0.03)continue;
    const a=mark(mk.t);if(!a||!a.tn)continue;const R=qmat(qfromEuler(q.phi,q.th,q.psi)),tn=a.tn;
    let y=[R[1],R[4],R[7]];y=vnorm(vsub(y,vscl(tn,vdot(y,tn))));const z=vcross(tn,y);   // across the path in the aircraft's lateral axis, and its up/down
    const P4=(u,v)=>vadd(c,vadd(vscl(y,u),vscl(z,v))),W=6,Z0=-2.8,Z1=1.5,ax=2.2,az=1.2,w=mk.m%15===0?2.6:2;
    for(const [sy,sz] of [[-1,0],[1,0],[-1,1],[1,1]]){const Y=sy*W,Zc=sz?Z1:Z0,dz=sz?-az:az;
      pgLine(P4(Y,Zc),P4(Y-sy*ax,Zc),w,w,WHITE,0.8*f,0.8*f);pgLine(P4(Y,Zc),P4(Y,Zc+dz),w,w,WHITE,0.8*f,0.8*f);}}
  // where the skids will touch, coloured by the sink rate; a cross where the model crashes
  if(ev.touch&&!ev.crash){const tq=ev.touch,col=hexRgb(predTouchCol(tq.vs)),c=Math.cos(tq.psi),s=Math.sin(tq.psi);
    for(const y of [-1.05,1.05]){const A=pgGround(tq.n-1.7*c-y*s,tq.e-1.7*s+y*c,0.1),B=pgGround(tq.n+1.7*c-y*s,tq.e+1.7*s+y*c,0.1);pgFlat(A,B,0.22,2.5,col,0.95);}
    let prev=null;for(let k=0;k<=36;k++){const a=k/36*2*Math.PI,g=pgGround(tq.n+2.6*Math.cos(a),tq.e+2.6*Math.sin(a),0.1);if(prev)pgFlat(prev,g,0.18,2,col,0.75);prev=g;}}
  if(ev.crash){const cq=ev.crash,col=hexRgb(HUD_COL.hot);for(const a of [Math.PI/4,-Math.PI/4]){const dx=3.2*Math.cos(a),dy=3.2*Math.sin(a);
    pgFlat(pgGround(cq.n-dx,cq.e-dy,0.12),pgGround(cq.n+dx,cq.e+dy,0.12),0.45,3.5,col,0.95);}}
  // (2.5 to 2.5.4 drew a see-through ghost of the aircraft 6 s ahead here, with a ring on the ground below it; left out in 2.6 as hard to read)
  // draw
  if(PGL.n){const pr=R3.pr.pred;gl.useProgram(pr.p);gl.bindBuffer(gl.ARRAY_BUFFER,PGL.buf);gl.bufferData(gl.ARRAY_BUFFER,PGL.a.subarray(0,PGL.n),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pr.a.aP);gl.vertexAttribPointer(pr.a.aP,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(pr.a.aC);gl.vertexAttribPointer(pr.a.aC,4,gl.FLOAT,false,28,12);
    gl.uniformMatrix4fv(pr.u.uMVP,false,R3.vp);gl.uniform3fv(pr.u.uCam,cam.pos);gl.uniform3fv(pr.u.uFog,R3.fog);gl.drawArrays(gl.TRIANGLES,0,PGL.n/7);}
}

/* ---- in the HUD (2D): the labels the view needs ---- */
function predLabel(x,X,Y,text,col,al){x.save();x.globalAlpha=al===undefined?1:al;x.font='bold 12px "Arial Narrow",sans-serif';const w=x.measureText(text).width+10;
  x.fillStyle='rgba(13,12,10,0.72)';x.fillRect(X-w/2,Y-9,w,18);x.fillStyle=col||'#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(text,X,Y);x.restore();}
function predDraw3D(x){
  const ev={touch:PD.touch,crash:PD.crash},T=PD.T;
  const vis=p=>p&&p[0]>-40&&p[0]<R3.w+40&&p[1]>-20&&p[1]<R3.h+20;
  let gl=null;
  if(T>2&&!ev.crash){const q=dispAt(T-0.05);const s=q&&project([q.n,q.e,q.d-1.2]);if(vis(s)&&(!gl||Math.hypot(s[0]-gl[0],s[1]-gl[1])>40))predLabel(x,s[0],s[1],`${Math.round(T)} s`,'#fff',0.75);}
  if(ev.touch&&!ev.crash){const tq=ev.touch,s=project(pgGround(tq.n,tq.e,0.1));if(vis(s))predLabel(x,s[0],s[1]+22,`touchdown ${tq.t.toFixed(1)} s · ${Math.round(tq.vs/FPM)} fpm`,predTouchCol(tq.vs));}
  if(ev.crash){const cq=ev.crash,s=project([cq.n,cq.e,cq.d]);if(vis(s))predLabel(x,s[0],s[1]-24,`${cq.why.toLowerCase()} in ${cq.t.toFixed(1)} s`,HUD_COL.hot);}
}

/* ---- the plan view, a radar scope (2.5.3): nose up, the aircraft at the centre. The track flown in the
   last 12 s (grey), the predicted track fading with time with a dot at the clock's whole seconds (every
   five on long paths), the ghost's outline where the aircraft will be at 6 s and its heading then, the
   touchdown, the hover spot when HOV holds one, the ground speed (the arrow). The scale grows with the
   path (±5 m to ±2 km).
   It is not redrawn continuously: a ping leaves the centre every 1.5 s and runs out to the edge in 0.6 s.
   Where its front passes, the picture is replaced by the prediction of that moment; beyond the front the
   last one stays; between pings it stands and glows down (afterglow). The picture is kept in the world:
   it moves and turns smoothly with the aircraft flying over it and changes only at a ping, so the
   aircraft can be seen following the path predicted at the last ping, or leaving it. The scale changes
   only at a ping. The height profile beside it is renewed by the same ping, its front running from now
   to the end. ---- */
const SCOPE={cur:null,prev:null,t0:-1e9,gen:-1,PER:1.5,RUN:0.6,fix:null};   // fix: the front held at this fraction (screenshots)
function predHeli(x,X,Y,h,k,col,al){   // a top-down outline: rotor circle (when large enough) and the fuselage arrow
  x.save();x.translate(X,Y);x.rotate(h);x.globalAlpha=al;x.strokeStyle=col;x.lineWidth=1.6;
  const rr=5.1*k;if(rr>=7&&rr<=30){x.globalAlpha=al*0.55;x.setLineDash([3,3]);x.beginPath();x.arc(0,0,rr,0,7);x.stroke();x.setLineDash([]);x.globalAlpha=al;}   // the rotor, when it fits
  const L=clamp(6*k,7,13);x.fillStyle='rgba(223,244,255,0.25)';x.beginPath();x.moveTo(0,-L);x.lineTo(-0.6*L,0.75*L);x.lineTo(0,0.38*L);x.lineTo(0.6*L,0.75*L);x.closePath();x.fill();x.beginPath();x.moveTo(0,-L);x.lineTo(-0.6*L,0.75*L);x.lineTo(0,0.38*L);x.lineTo(0.6*L,0.75*L);x.closePath();x.stroke();x.restore();}
/* what a ping shows, taken from the drawn prediction, in the world */
function scopeSnap(){
  const T=PD.T,g=predGhost(),vN=mrot(qmat(S.q),S.vb),c=Math.cos(S.eul[2]),s=Math.sin(S.eul[2]);
  const track=PD.path.slice(1).map(q=>({n:q.n,e:q.e,t:q.t,fa:q.fa,h:q.h,alt:-q.d}));
  // the scale: the path (and the hover spot) seen from the aircraft now
  let ext=4;const ex=(n,e)=>{const dn=n-S.pos[0],de=e-S.pos[1];ext=Math.max(ext,Math.abs(dn*c+de*s),Math.abs(-dn*s+de*c));};
  for(const q of track)ex(q.n,q.e);if(AFCS.hov)ex(AFCS.spotN,AFCS.spotE);if(GUIDE.on&&Math.hypot(GUIDE.n-S.pos[0],GUIDE.e-S.pos[1])<1700)ex(GUIDE.n,GUIDE.e);   // click to fly: the target in sight, up to the 2 km scale
  const sc=[5,10,20,50,100,200,500,1000,2000].find(v=>v>=ext*1.1)||2000;
  // the profile's scale: near the ground the skid height, higher up the altitude around the present one
  const near=Math.min(S.hAGL,...track.map(q=>q.h))<45,hs=[S.hAGL,...track.map(q=>q.h)];
  const prof=near?{near,sc:[10,20,50,100,200,500].find(v=>v*FT>=Math.max(...hs)*1.15)||500}
    :{near,ref:S.alt,span:[20,50,100,200,500,1000,2000].find(v=>v>=Math.max(0,...track.map(q=>Math.abs(q.alt-S.alt)/FT))*1.15)||2000};
  return {at:S.t,T,pos:[S.pos[0],S.pos[1]],h0:S.hAGL,alt0:S.alt,track,sc,prof,
    marks:dispMarks(T>12?5:1,0.15).map(m=>({n:m.q.n,e:m.q.e,t:m.t,m:m.m,fa:m.q.fa})),
    ghost:g?{n:g.q.n,e:g.q.e,psi:g.q.psi,t:g.t}:null,touch:PD.touch&&{...PD.touch},crash:PD.crash&&{...PD.crash},vel:[vN[0],vN[1]]};}
/* once per frame before the scope and the profile: a new ping every 1.5 s (at once after a reset) */
function scopeStep(){const now=R3.time||0;
  if(SCOPE.gen!==PRED.gen||!SCOPE.cur){SCOPE.cur=SCOPE.prev=scopeSnap();SCOPE.gen=PRED.gen;SCOPE.t0=now-SCOPE.RUN;return;}
  if(SCOPE.fix===null&&(now-SCOPE.t0>=SCOPE.PER||now<SCOPE.t0)){SCOPE.prev=SCOPE.cur;SCOPE.cur=scopeSnap();SCOPE.t0=now;}}
function scopeFront(){return SCOPE.fix!==null?SCOPE.fix:clamp(((R3.time||0)-SCOPE.t0)/SCOPE.RUN,0,1);}
function scopeLife(){return SCOPE.fix!==null?SCOPE.fix*SCOPE.RUN/SCOPE.PER:clamp(((R3.time||0)-SCOPE.t0)/SCOPE.PER,0,1);}
/* one ping's picture, placed by where the aircraft is and points now */
function scopeContent(x,sn,cx,cy,R,al){
  const psi=S.eul[2],c=Math.cos(psi),s=Math.sin(psi),k=R/sn.sc,T=Math.max(1,sn.T),age=S.t-sn.at;
  const P=(n,e)=>{const dn=n-S.pos[0],de=e-S.pos[1];return [cx+(-dn*s+de*c)*k,cy-(dn*c+de*s)*k];};
  const inR=p=>Math.abs(p[0]-cx)<=R+6&&Math.abs(p[1]-cy)<=R+6;
  x.save();x.globalAlpha=al;
  // the track, from where the aircraft was at the ping: thick and bright first, thinner and fainter towards the end
  if(sn.track.length){x.lineCap='round';let pr=P(sn.pos[0],sn.pos[1]);
    for(const q of sn.track){const p=P(q.n,q.e),f=(1-0.65*q.t/T)*q.fa;x.strokeStyle=`rgba(255,255,255,${(0.95*f).toFixed(3)})`;x.lineWidth=1.2+2.3*f;x.beginPath();x.moveTo(pr[0],pr[1]);x.lineTo(p[0],p[1]);x.stroke();pr=p;}
    x.lineCap='butt';x.fillStyle='#fff';
    for(const m of sn.marks){if(m.t-age<0.1)continue;const p=P(m.n,m.e);x.globalAlpha=al*(1-0.55*m.t/T)*m.fa;x.beginPath();x.arc(p[0],p[1],m.m%5===0?3.4:2.4,0,7);x.fill();}x.globalAlpha=al;
    if(sn.ghost){const p=P(sn.ghost.n,sn.ghost.e);if(inR(p)&&Math.hypot(p[0]-cx,p[1]-cy)>4){predHeli(x,p[0],p[1],wrapPi(sn.ghost.psi-psi),k,'#dff4ff',0.95*al);
      x.fillStyle='#dff4ff';x.font='bold 10px "Arial Narrow",sans-serif';x.textAlign=p[0]>=cx?'left':'right';x.fillText(`${Math.round(sn.ghost.t)} s`,p[0]+(p[0]>=cx?12:-12),p[1]+4);}}
    if(T>PRED_GHOST+1){const q=sn.track[sn.track.length-1],p=P(q.n,q.e);if(inR(p)){x.fillStyle='rgba(255,255,255,0.75)';x.font='10px "Arial Narrow",sans-serif';x.textAlign=p[0]>=cx?'left':'right';x.fillText(`${Math.round(T)} s`,p[0]+(p[0]>=cx?7:-7),p[1]-5);}}}
  // touchdown and crash
  if(sn.touch&&!sn.crash){const p=P(sn.touch.n,sn.touch.e),h=wrapPi(sn.touch.psi-psi);
    x.save();x.translate(p[0],p[1]);x.rotate(h);x.strokeStyle=predTouchCol(sn.touch.vs);x.lineWidth=2.5;const L=clamp(1.7*k,6,11),Wd=clamp(1.05*k,4,7);x.beginPath();x.moveTo(-Wd,-L);x.lineTo(-Wd,L);x.moveTo(Wd,-L);x.lineTo(Wd,L);x.stroke();x.restore();}
  if(sn.crash){const p=P(sn.crash.n,sn.crash.e);x.strokeStyle=HUD_COL.hot;x.lineWidth=3;x.beginPath();x.moveTo(p[0]-6,p[1]-6);x.lineTo(p[0]+6,p[1]+6);x.moveTo(p[0]+6,p[1]-6);x.lineTo(p[0]-6,p[1]+6);x.stroke();}
  // the ground speed at the ping, from the aircraft
  {const v=[sn.vel[0]*c+sn.vel[1]*s,-sn.vel[0]*s+sn.vel[1]*c],sp=Math.hypot(v[0],v[1]);
   if(sp>0.15){const L=Math.min(R,sp*k);x.strokeStyle=HUD_COL.ice;x.lineWidth=2.5;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+v[1]/sp*L,cy-v[0]/sp*L);x.stroke();}}
  x.restore();}
function predDrawPlan(x,cx,cy,R){
  scopeStep();const cur=SCOPE.cur,prev=SCOPE.prev;if(!cur)return;
  const f=scopeFront(),life=scopeLife(),Rmax=(R+8)*1.42,rho=f*Rmax;
  const psi=S.eul[2],c=Math.cos(psi),s=Math.sin(psi),k=R/cur.sc;
  const rel=(n,e)=>{const dn=n-S.pos[0],de=e-S.pos[1];return [dn*c+de*s,-dn*s+de*c];},X=r=>cx+r[1]*k,Y=r=>cy-r[0]*k;
  x.save();x.fillStyle='rgba(13,12,10,0.62)';x.fillRect(cx-R-8,cy-R-8,2*R+16,2*R+16);
  x.beginPath();x.rect(cx-R-8,cy-R-8,2*R+16,2*R+16);x.clip();
  x.strokeStyle='rgba(138,130,116,0.5)';x.lineWidth=1;x.beginPath();x.arc(cx,cy,R/2,0,7);x.moveTo(cx+R,cy);x.arc(cx,cy,R,0,7);x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
  x.fillStyle='rgba(138,130,116,0.9)';x.font='11px "Arial Narrow",sans-serif';x.textAlign='left';x.textBaseline='alphabetic';x.fillText(cur.sc>=1000?`${cur.sc/1000} km`:`${cur.sc} m`,cx+4,cy-R+11);
  // the track flown so far, and the hover spot: as they are
  if(PRED.past.length>1){x.strokeStyle='rgba(200,192,176,0.5)';x.lineWidth=1.5;x.setLineDash([2,3]);x.beginPath();PRED.past.forEach((q,i)=>{const r=rel(q.n,q.e);if(i)x.lineTo(X(r),Y(r));else x.moveTo(X(r),Y(r));});x.lineTo(cx,cy);x.stroke();x.setLineDash([]);}
  if(AFCS.hov){const r=rel(AFCS.spotN,AFCS.spotE),px=clamp(X(r),cx-R,cx+R),py=clamp(Y(r),cy-R,cy+R),act=AFCS_UI.act.lon||AFCS_UI.act.lat,pulse=0.55+0.45*Math.sin(S.t*7);
    x.strokeStyle=AFC_COL.hov;x.lineWidth=act?3.5:2;x.globalAlpha=act?pulse:1;x.beginPath();x.arc(px,py,7,0,7);x.moveTo(px-11,py);x.lineTo(px+11,py);x.moveTo(px,py-11);x.lineTo(px,py+11);x.stroke();
    x.setLineDash([4,4]);x.beginPath();x.moveTo(cx,cy);x.lineTo(px,py);x.stroke();x.setLineDash([]);x.globalAlpha=1;}
  // beyond the front the last ping's picture, glowing down; inside it the new one
  if(f<1){x.save();x.beginPath();x.rect(cx-R-8,cy-R-8,2*R+16,2*R+16);x.arc(cx,cy,rho,0,2*Math.PI);x.clip('evenodd');scopeContent(x,prev,cx,cy,R,0.85-0.1*f);x.restore();}
  if(rho>0.5){x.save();x.beginPath();x.arc(cx,cy,rho,0,2*Math.PI);x.clip();scopeContent(x,cur,cx,cy,R,1-0.15*life);x.restore();}
  // the ping's front: a thin ring with a soft glow behind it
  if(f<1&&rho>1){const a=0.22*Math.pow(1-f,1.5),g=x.createRadialGradient(cx,cy,Math.max(0,rho-10),cx,cy,rho);g.addColorStop(0,'rgba(111,211,224,0)');g.addColorStop(1,`rgba(111,211,224,${(0.06*(1-f)).toFixed(3)})`);   // (2.5.4: fainter, at the user's request)
    x.fillStyle=g;x.beginPath();x.arc(cx,cy,rho,0,2*Math.PI);x.arc(cx,cy,Math.max(0,rho-10),0,2*Math.PI,true);x.fill();
    x.strokeStyle=`rgba(150,232,242,${a.toFixed(3)})`;x.lineWidth=1;x.beginPath();x.arc(cx,cy,rho,0,2*Math.PI);x.stroke();}
  if(GUIDE.on)guideDrawPlan(x,X(rel(GUIDE.n,GUIDE.e)),Y(rel(GUIDE.n,GUIDE.e)),cx,cy,R);   // click to fly (92_coach.js): the target, live, over the ping
  // the aircraft: nose up
  x.fillStyle=HUD_COL.amber;x.beginPath();x.moveTo(cx,cy-8);x.lineTo(cx-5,cy+6);x.lineTo(cx,cy+3);x.lineTo(cx+5,cy+6);x.closePath();x.fill();
  x.fillStyle='rgba(138,130,116,0.95)';x.font='11px "Arial Narrow",sans-serif';x.textAlign='left';
  x.fillText(PRED.res?`next ${Math.round(cur.T)} s${cfg.predictT==='auto'||cfg.predictT===undefined?'':' (set)'}`:'predicting…',cx-R-4,cy+R+3);
  x.restore();}
/* ---- the height profile: the same seconds from left to right. Near the ground (below ~150 ft) the
   skid height above the ground with the ground as the bottom line, higher up the altitude around the
   present one. The ALT target in its colour when ALT holds one; the touchdown. Renewed by the plan
   view's ping, its front running from now to the end; between pings the trace moves left with time. ---- */
function profMap(sn,top,bot){const p=sn.prof;
  if(p.near)return {val:q=>q.h,Y:hh=>bot-(bot-top)*clamp(hh/(p.sc*FT),0,1.08),now:S.hAGL,label:`${p.sc} ft`,tgt:AFCS.alt?AFCS.tAlt-(S.alt-S.hAGL):null};
  const mid=(top+bot)/2;return {val:q=>q.alt,Y:hh=>mid-(bot-top)/2*clamp((hh-p.ref)/FT/p.span,-1.08,1.08),now:S.alt,label:`±${p.span} ft`,tgt:AFCS.alt?AFCS.tAlt:null};}
function profContent(x,sn,L,Rr,top,bot,T,al){const m=profMap(sn,top,bot),age=S.t-sn.at,X=t=>L+(Rr-L)*clamp(t/T,0,1);
  x.save();x.globalAlpha=al;
  if(sn.track.length){x.lineCap='round';let pr=[X(-age),m.Y(sn.prof.near?sn.h0:sn.alt0)];
    for(const q of sn.track){const t=q.t-age,p=[X(t),m.Y(m.val(q))],f=(1-0.65*q.t/T)*q.fa;if(t<0){pr=p;continue;}x.strokeStyle=`rgba(255,255,255,${(0.95*f).toFixed(3)})`;x.lineWidth=1.2+2.3*f;x.beginPath();x.moveTo(pr[0],pr[1]);x.lineTo(p[0],p[1]);x.stroke();pr=p;}x.lineCap='butt';}
  if(sn.touch&&!sn.crash&&sn.prof.near){const tx=X(sn.touch.t-age);x.fillStyle=predTouchCol(sn.touch.vs);x.beginPath();x.arc(tx,bot,4.5,0,7);x.fill();
    x.font='bold 10px "Arial Narrow",sans-serif';const rgt=tx>(L+Rr)/2;x.textAlign=rgt?'right':'left';x.fillText(`${Math.round(sn.touch.vs/FPM)} fpm`,tx+(rgt?-6:6),bot-6);}
  if(sn.crash){const tx=X(sn.crash.t-age);x.strokeStyle=HUD_COL.hot;x.lineWidth=2.5;x.beginPath();x.moveTo(tx-5,bot-5);x.lineTo(tx+5,bot+5);x.moveTo(tx+5,bot-5);x.lineTo(tx-5,bot+5);x.stroke();}
  x.restore();}
function predDrawProfile(x,x0,y0,w,h){
  const cur=SCOPE.cur,prev=SCOPE.prev;if(!cur)return;
  x.save();x.fillStyle='rgba(13,12,10,0.62)';x.fillRect(x0,y0,w,h);
  const T=Math.max(1,cur.T),L=x0+8,Rr=x0+w-8,top=y0+18,bot=y0+h-18,X=t=>L+(Rr-L)*clamp(t/T,0,1),f=scopeFront(),life=scopeLife(),xs=L+(Rr-L)*f,m=profMap(cur,top,bot);
  x.fillStyle='rgba(138,130,116,0.95)';x.font='11px "Arial Narrow",sans-serif';x.textAlign='left';x.textBaseline='alphabetic';x.fillText('height',x0+5,y0+12);
  if(cur.prof.near){x.strokeStyle='rgba(150,120,80,0.9)';x.lineWidth=2;x.beginPath();x.moveTo(L,bot);x.lineTo(Rr,bot);x.stroke();}
  else{x.strokeStyle='rgba(138,130,116,0.5)';x.lineWidth=1;x.beginPath();x.moveTo(L,(top+bot)/2);x.lineTo(Rr,(top+bot)/2);x.stroke();}
  x.textAlign='right';x.fillText(m.label,x0+w-5,y0+12);
  // time marks
  x.strokeStyle='rgba(138,130,116,0.6)';x.lineWidth=1;const step=T>12?5:1;x.beginPath();for(let t=step;t<=T+1e-6;t+=step){x.moveTo(X(t),bot+2);x.lineTo(X(t),bot+(t%5===0?7:5));}x.stroke();
  x.textAlign='center';x.fillText(`${Math.round(T)} s`,X(T)-4,y0+h-3);x.textAlign='left';x.fillText('now',L-3,y0+h-3);
  if(m.tgt!==null){const ty=m.Y(m.tgt);x.strokeStyle=AFC_COL.alt;x.lineWidth=1.5;x.setLineDash([5,4]);x.beginPath();x.moveTo(L,ty);x.lineTo(Rr,ty);x.stroke();x.setLineDash([]);}
  // the trace: right of the ping's front the last one, left of it the new one
  x.save();x.beginPath();x.rect(L-6,top-12,Rr-L+12,bot-top+24);x.clip();
  if(f<1){x.save();x.beginPath();x.rect(xs,top-12,Rr-xs+6,bot-top+24);x.clip();profContent(x,prev,L,Rr,top,bot,Math.max(1,prev.T),0.85-0.1*f);x.restore();}
  if(xs>L){x.save();x.beginPath();x.rect(L-6,top-12,xs-L+6,bot-top+24);x.clip();profContent(x,cur,L,Rr,top,bot,T,1-0.15*life);x.restore();}
  if(f<1){x.strokeStyle=`rgba(150,232,242,${(0.22*Math.pow(1-f,1.5)).toFixed(3)})`;x.lineWidth=1;x.beginPath();x.moveTo(xs,top-6);x.lineTo(xs,bot+2);x.stroke();}
  x.restore();
  x.fillStyle=HUD_COL.amber;x.beginPath();x.arc(L,m.Y(m.now),3.5,0,7);x.fill();
  x.restore();}
/* narrow windows (no room for the profile): the predicted height change as a bar at the plan view's right edge,
   ±50 ft in the hover, ±500 ft above 40 kt */
function predDrawHeightBar(x,cx,cy,R){const T=PD.T,q=T>0?dispAt(T-0.01):null;if(!q)return;
  const dh=(S.pos[2]-q.d)/FT,span=S.ias>40*KT?500:50,hx=cx+R+3,hh=R*0.9,yy=cy-clamp(dh/span,-1,1)*hh;x.save();
  x.strokeStyle='rgba(138,130,116,0.6)';x.lineWidth=1;x.beginPath();x.moveTo(hx,cy-hh);x.lineTo(hx,cy+hh);x.moveTo(hx-3,cy);x.lineTo(hx+3,cy);x.stroke();
  x.strokeStyle='#fff';x.lineWidth=3;x.beginPath();x.moveTo(hx,cy);x.lineTo(hx,yy);x.stroke();
  x.fillStyle='#fff';x.font='10px "Arial Narrow",sans-serif';x.textAlign='right';x.fillText(`${dh>=0?'+':''}${Math.round(dh)} ft`,hx-3,cy+R+3);x.restore();}
