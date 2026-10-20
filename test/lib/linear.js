/* Linear analysis of the simulation: quasi-static linearisation of the
   rigid-body equations around a trim, eigenvalues, mode classification and
   frequency response by sine dwells. Shared by test/qualities.js,
   test/scenarios.js (group E) and test/mutation.js.

   Linearisation: the body states u v w p q r phi theta are frozen at a
   perturbed value while the rotor, inflow and engine states settle; the
   forces and moments are averaged over whole revolutions and turned into
   body accelerations. Central differences give A (8 x 8) and B (per full
   control travel). The rotor states are not part of the model: the modes
   are the rigid-body modes a pilot feels. */
'use strict';
const D2R=Math.PI/180;
function inv3(a){const[a0,a1,a2,a3,a4,a5,a6,a7,a8]=a;const d=a0*(a4*a8-a5*a7)-a1*(a3*a8-a5*a6)+a2*(a3*a7-a4*a6);
  return[(a4*a8-a5*a7)/d,(a2*a7-a1*a8)/d,(a1*a5-a2*a4)/d,(a5*a6-a3*a8)/d,(a0*a8-a2*a6)/d,(a2*a3-a0*a5)/d,(a3*a7-a4*a6)/d,(a1*a6-a0*a7)/d,(a0*a4-a1*a3)/d];}
function qfromEuler(phi,th,psi){const c1=Math.cos(phi/2),s1=Math.sin(phi/2),c2=Math.cos(th/2),s2=Math.sin(th/2),c3=Math.cos(psi/2),s3=Math.sin(psi/2);
  return[c1*c2*c3+s1*s2*s3,s1*c2*c3-c1*s2*s3,c1*s2*c3+s1*c2*s3,c1*c2*s3-s1*s2*c3];}
const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mv=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];

/* Trim with the autopilot: 'hover' holds position, otherwise level flight at kt. */
function trim(E,mode,kt){const {AP,IN,DT}=E;
  if(mode==='hover'){E.reset('high');AP.on=true;AP.mode='hover';AP.auto=false;AP.alt=-E.S.pos[2];AP.hdg=E.S.eul[2];AP.posN=E.S.pos[0];AP.posE=E.S.pos[1];AP.vN=0;AP.vE=0;}
  else{E.reset('cruise');E.S.vb[0]=kt*E.KT;AP.on=true;AP.mode='cruise';AP.auto=false;AP.ias=kt;AP.alt=-E.S.pos[2];AP.hdg=E.S.eul[2];}
  for(let t=0;t<(mode==='hover'?40:60);t+=DT){const o=E.apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;E.step(DT);}
  AP.on=false;for(const k of ['col','lon','lat','ped'])IN[k]=E.S.ctl[k];
  return E;}

function linearise(E){
  const {IN,DT}=E;const S0=structuredClone(E.S),eul0=E.S.eul.slice();
  const m=S0.m,I=E.inertia?E.inertia():E.H.I.map(v=>v*S0.m/E.H.m),Ii=inv3(I);
  const Nset=Math.round(0.8/DT),Nrev=Math.round(2*Math.PI/S0.rot.Om/DT),Navg=2*Nrev;   // settle, then two revolutions
  function xdot(x,ctl){E.S=structuredClone(S0);const S=E.S;const vb=[x[0],x[1],x[2]],om=[x[3],x[4],x[5]],q=qfromEuler(x[6],x[7],eul0[2]);
    for(const k of ['col','lon','lat','ped']){IN[k]=S0.ctl[k]+((ctl&&ctl[k])||0);S.ctl[k]=IN[k];}
    const F=[0,0,0],M=[0,0,0];let n=0;
    for(let i=0;i<Nset+Navg;i++){S.vb=vb.slice();S.om=om.slice();S.q=q.slice();S.omd=[0,0,0];S.pos=S0.pos.slice();E.step(DT);
      if(i>=Nset){for(let k=0;k<3;k++){F[k]+=S.Fb[k];M[k]+=S.Mb[k];}n++;}}
    for(let k=0;k<3;k++){F[k]/=n;M[k]/=n;}
    const g=cr(om,mv(I,om)),wd=mv(Ii,[M[0]-g[0],M[1]-g[1],M[2]-g[2]]),wv=cr(om,vb);
    const phi=x[6],th=x[7];
    return [F[0]/m-wv[0],F[1]/m-wv[1],F[2]/m-wv[2],...wd,om[0]+(om[1]*Math.sin(phi)+om[2]*Math.cos(phi))*Math.tan(th),om[1]*Math.cos(phi)-om[2]*Math.sin(phi)];}
  const x0=[...S0.vb,0,0,0,eul0[0],eul0[1]];
  const d=[0.5,0.5,0.5,2*D2R,2*D2R,2*D2R,1*D2R,1*D2R];
  const A=[...Array(8)].map(()=>new Array(8).fill(0));
  for(let j=0;j<8;j++){const xp=x0.slice(),xm=x0.slice();xp[j]+=d[j];xm[j]-=d[j];const fp=xdot(xp),fm=xdot(xm);for(let i=0;i<8;i++)A[i][j]=(fp[i]-fm[i])/(2*d[j]);}
  const B={};for(const k of ['col','lon','lat','ped']){const fp=xdot(x0,{[k]:0.02}),fm=xdot(x0,{[k]:-0.02});B[k]=fp.map((v,i)=>(v-fm[i])/0.04);}
  E.S=S0;return {A,B,x0,names:['u','v','w','p','q','r','phi','th']};}

/* Eigenvalues of a real square matrix: Householder reduction to upper
   Hessenberg form, then the shifted QR algorithm in complex arithmetic
   (Givens rotations, Wilkinson shift, deflation from the bottom). */
function eig(A0){
  const n=A0.length,H=A0.map(r=>r.slice());
  for(let k=0;k<n-2;k++){let a=0;for(let i=k+1;i<n;i++)a+=H[i][k]*H[i][k];a=Math.sqrt(a);if(a<1e-300)continue;
    const alpha=H[k+1][k]>0?-a:a,v=new Array(n).fill(0);for(let i=k+1;i<n;i++)v[i]=H[i][k];v[k+1]-=alpha;
    let vn=0;for(let i=k+1;i<n;i++)vn+=v[i]*v[i];if(vn<1e-300)continue;
    for(let j=0;j<n;j++){let s=0;for(let i=k+1;i<n;i++)s+=v[i]*H[i][j];s*=2/vn;for(let i=k+1;i<n;i++)H[i][j]-=s*v[i];}
    for(let i=0;i<n;i++){let s=0;for(let j=k+1;j<n;j++)s+=H[i][j]*v[j];s*=2/vn;for(let j=k+1;j<n;j++)H[i][j]-=s*v[j];}}
  const re=H.map(r=>r.slice()),im=H.map(r=>r.map(()=>0)),out=[];
  const cabs=(a,b)=>Math.hypot(a,b);
  let m=n,iter=0;
  while(m>0){
    if(m===1){out.push([re[0][0],im[0][0]]);break;}
    let l=m-1;while(l>0){const s=cabs(re[l][l],im[l][l])+cabs(re[l-1][l-1],im[l-1][l-1]);if(cabs(re[l][l-1],im[l][l-1])<=1e-13*(s||1))break;l--;}
    if(l===m-1){out.push([re[m-1][m-1],im[m-1][m-1]]);m--;iter=0;continue;}
    if(l>0){re[l][l-1]=0;im[l][l-1]=0;}
    iter++;if(iter>500)throw new Error('eig: no convergence');
    // Wilkinson shift from the trailing 2x2 of the active block
    const ar=re[m-2][m-2],ai=im[m-2][m-2],br=re[m-2][m-1],bi=im[m-2][m-1],cr_=re[m-1][m-2],ci=im[m-1][m-2],dr=re[m-1][m-1],di=im[m-1][m-1];
    const tr=[(ar+dr)/2,(ai+di)/2],df=[(ar-dr)/2,(ai-di)/2];
    let disc=[df[0]*df[0]-df[1]*df[1]+(br*cr_-bi*ci),2*df[0]*df[1]+(br*ci+bi*cr_)];
    const r0=Math.sqrt(cabs(disc[0],disc[1])),t0=Math.atan2(disc[1],disc[0])/2,sq=[r0*Math.cos(t0),r0*Math.sin(t0)];
    const e1=[tr[0]+sq[0],tr[1]+sq[1]],e2=[tr[0]-sq[0],tr[1]-sq[1]];
    let mu=cabs(e1[0]-dr,e1[1]-di)<cabs(e2[0]-dr,e2[1]-di)?e1:e2;
    if(iter%11===10)mu=[dr+0.75*cabs(re[m-1][m-2],im[m-1][m-2]),di];   // exceptional shift
    for(let i=l;i<m;i++){re[i][i]-=mu[0];im[i][i]-=mu[1];}
    const G=[];
    for(let k=l;k<m-1;k++){const a=[re[k][k],im[k][k]],b=[re[k+1][k],im[k+1][k]],r=Math.hypot(a[0],a[1],b[0],b[1]);
      const c=r?[a[0]/r,a[1]/r]:[1,0],s=r?[b[0]/r,b[1]/r]:[0,0];G.push([c,s]);
      for(let j=k;j<m;j++){const x=[re[k][j],im[k][j]],y=[re[k+1][j],im[k+1][j]];
        // [x;y] <- [[conj c, conj s],[-s, c]] [x;y]
        re[k][j]=c[0]*x[0]+c[1]*x[1]+s[0]*y[0]+s[1]*y[1];im[k][j]=c[0]*x[1]-c[1]*x[0]+s[0]*y[1]-s[1]*y[0];
        re[k+1][j]=-(s[0]*x[0]-s[1]*x[1])+(c[0]*y[0]-c[1]*y[1]);im[k+1][j]=-(s[0]*x[1]+s[1]*x[0])+(c[0]*y[1]+c[1]*y[0]);}}
    for(let k=l;k<m-1;k++){const [c,s]=G[k-l];
      for(let i=l;i<=Math.min(k+2,m-1);i++){const x=[re[i][k],im[i][k]],y=[re[i][k+1],im[i][k+1]];
        // [x y] <- [x y] [[c, -conj s],[s, conj c]]
        re[i][k]=x[0]*c[0]-x[1]*c[1]+y[0]*s[0]-y[1]*s[1];im[i][k]=x[0]*c[1]+x[1]*c[0]+y[0]*s[1]+y[1]*s[0];
        re[i][k+1]=-(x[0]*s[0]+x[1]*s[1])+(y[0]*c[0]+y[1]*c[1]);im[i][k+1]=-(x[1]*s[0]-x[0]*s[1])+(y[1]*c[0]-y[0]*c[1]);}}
    for(let i=l;i<m;i++){re[i][i]+=mu[0];im[i][i]+=mu[1];}
  }
  return out.map(([r,i])=>({re:r,im:Math.abs(i)<1e-9?0:i}));}

/* Modes: one entry per real root or complex pair, sorted by frequency. */
function modes(A,idx){const sub=idx?idx.map(i=>idx.map(j=>A[i][j])):A;const ev=eig(sub),out=[];
  for(const e of ev){if(e.im<0)continue;const w=Math.hypot(e.re,e.im);
    out.push(e.im>0?{re:e.re,im:e.im,osc:true,period:2*Math.PI/e.im,zeta:-e.re/w,t2:e.re>0?Math.log(2)/e.re:null}
                   :{re:e.re,im:0,osc:false,tau:e.re<0?-1/e.re:null,t2:e.re>0?Math.log(2)/e.re:null});}
  return out.sort((a,b)=>Math.hypot(a.re,a.im)-Math.hypot(b.re,b.im));}
function fmtMode(md){return md.osc?`${md.re>=0?'+':''}${md.re.toFixed(3)}±${md.im.toFixed(3)}i  period ${md.period.toFixed(1)} s, zeta ${md.zeta.toFixed(2)}${md.t2?`, doubles in ${md.t2.toFixed(1)} s`:''}`
  :`${md.re>=0?'+':''}${md.re.toFixed(3)}  ${md.tau?`time constant ${md.tau.toFixed(2)} s`:`doubles in ${md.t2.toFixed(1)} s`}`;}

/* ADS-33 small-amplitude attitude bandwidth by sine dwells around a trim
   (bare airframe). The swept axis gets the sine plus a weak attitude hold,
   the response is attitude over total stick at the dwell frequency (exact
   for a noise-free system in closed loop); the autopilot holds the other
   axes. Returns phase/gain bandwidth, w180 and phase delay. */
/* ADS-33 attitude bandwidth by sine dwells. Each frequency is flown twice,
   with the input and its negative, and the two transfer estimates are
   averaged: a single sign mixes in the even-order nonlinearity of the trim
   and moved the roll phase delay by 6 ms when the rotor's sense changed. */
/* ADS-33 attitude bandwidth and phase delay from sine sweeps of one cyclic axis around a trim, with a loose
   attitude hold on top (as a pilot keeps the aircraft near trim during a sweep; the transfer function is
   taken from the total control input, so the loop does not bias it). opts.colFixed: the collective stays at
   its trim value, as in a flight-test sweep; otherwise (until 2.2) the autopilot held the height with it,
   which changes the pitch response below ~1.5 rad/s. */
function bandwidth(mkTrimmed,axis,ws,signs,opts){opts=opts||{};
  ws=ws||[0.8,1.2,1.6,2,2.5,3,3.5,4,5,6,7,8,10,12,15,18,22];signs=signs||[1,-1];
  const R=[];let prev=null;
  for(const w of ws){let Hr=0,Hi=0;
   for(const sgnA of signs){const E=mkTrimmed();const {AP,IN,DT}=E;AP.on=true;const k=axis==='pitch'?'lon':'lat',ang=axis==='pitch'?1:0,sg=axis==='pitch'?-1:1;
    const c0=IN[k],col0=IN.col,a0=E.S.eul[ang],A=0.04*sgnA,T=2*Math.PI/w,nc=Math.max(3,Math.ceil(8/T)),t0=2*T,t1=t0+nc*T;let yr=0,yi=0,dr=0,di=0,int=0;
    for(let t=0;t<t1;t+=DT){const o=E.apStep(DT);const e=E.S.eul[ang]-a0;int+=e*DT;const fb=-sg*(0.25*e+0.05*int);
      const u=c0+A*Math.sin(w*t)+fb;IN.col=opts.colFixed?col0:o.col;IN.ped=o.ped;IN.lon=k==='lon'?u:o.lon;IN.lat=k==='lat'?u:o.lat;E.step(DT);
      if(t>=t0){const y=sg*(E.S.eul[ang]-a0),d=u-c0,c=Math.cos(w*t),s=Math.sin(w*t);yr+=y*c;yi-=y*s;dr+=d*c;di-=d*s;}}
    const den=dr*dr+di*di;Hr+=(yr*dr+yi*di)/den/signs.length;Hi+=(yi*dr-yr*di)/den/signs.length;}
    const hr=Hr,hi=Hi;let ph=Math.atan2(hi,hr)*180/Math.PI;
    if(prev!==null){while(ph-prev>180)ph-=360;while(ph-prev<-180)ph+=360;}prev=ph;R.push({w,gain:20*Math.log10(Math.hypot(hr,hi)),ph});}
  const cross=(f,x)=>{for(let i=1;i<R.length;i++){const a=f(R[i-1]),b=f(R[i]);if((a-x)*(b-x)<=0)return Math.exp(Math.log(R[i-1].w)+(x-a)/(b-a)*(Math.log(R[i].w)-Math.log(R[i-1].w)));}return null;};
  const at=(f,w)=>{for(let i=1;i<R.length;i++)if(R[i].w>=w){const q=(Math.log(w)-Math.log(R[i-1].w))/(Math.log(R[i].w)-Math.log(R[i-1].w));return f(R[i-1])+q*(f(R[i])-f(R[i-1]));}return null;};
  const wPh=cross(r=>r.ph,-135),w180=cross(r=>r.ph,-180);
  const wGain=w180?cross(r=>r.gain,at(r=>r.gain,w180)+6):null;
  const ph2=w180?at(r=>r.ph,2*w180):null,tp=ph2!==null?-(ph2+180)/(57.3*2*w180):null;
  return {wPh,wGain,bw:wGain?Math.min(wPh,wGain):wPh,w180,tp,R};}

module.exports={trim,linearise,eig,modes,fmtMode,bandwidth};
