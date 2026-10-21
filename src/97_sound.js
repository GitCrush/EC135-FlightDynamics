/* ═══════════════ SOUND (2.8, 2.8.1) ═══════════════
   Web Audio, started on the first click. Every source is synthesised from the state of the model, nothing
   is a recording. What a helicopter sounds like, and where it comes from:
   - Main rotor: a pressure pulse at every blade passage (4 per rev: 26 Hz at 100 % NR), heard as the thump
     and its harmonics; the blades are never quite alike, so there is a little once-per-rev in it. Thrust
     makes it louder (loading noise), the tip speed louder still. Descending into its own wake (blade-vortex
     interaction), in vortex ring and at high speed (the advancing tip near Mach 0.8) the pulses turn sharp:
     the slap. Under it the broadband swish of the blades, pulsing with every passage.
   - Fenestron: 10 blades at 8.91 × the rotor speed (587 Hz blade passage), spaced unevenly (here ±8.6° in
     a once-around modulation) as in the EC135, so the energy is spread over sidebands instead of one
     whistle; louder and brighter with its thrust, over the broadband rush of the duct.
   - Turbines: the gas generator's whine follows N1 (the start sweeps it up from nothing), the exhaust roar
     the power; two engines are never quite alike, so a slow beat.
   - Main gearbox: the gear meshes sing at fixed multiples of the rotor speed, loudest in the cabin (in
     helicopter cabins the 500 to 5000 Hz mesh tones and the blade passage dominate).
   - Air rushing past with the square of the airspeed; skids on the ground (touchdown, sliding); the low-NR
     horn.
   Where you listen: in the cockpit through a headset (highs muffled, the thump and the gearbox), outside
   the Fenestron, the rotor and the engines; from the tower the distance (level, air absorbing the highs)
   and the Doppler shift of a passing aircraft. The volume is in the setup. */
const SND={ctx:null,on:false};
function sndWave(c,N,fn){const re=new Float32Array(N+1),im=new Float32Array(N+1);for(let k=1;k<=N;k++){const v=fn(k);re[k]=v[0];im[k]=v[1];}return c.createPeriodicWave(re,im);}
function sndGain(c,v,dst){const g=c.createGain();g.gain.value=v||0;if(dst)g.connect(dst);return g;}
function sndFilt(c,type,f,Q,dst){const b=c.createBiquadFilter();b.type=type;b.frequency.value=f;if(Q!==undefined)b.Q.value=Q;if(dst)b.connect(dst);return b;}
function sndOsc(c,wave,dst){const o=c.createOscillator();if(typeof wave==='string')o.type=wave;else o.setPeriodicWave(wave);o.frequency.value=1;if(dst)o.connect(dst);o.start();return o;}
function sndNoise(c,buf,off,dst){const s=c.createBufferSource();s.buffer=buf;s.loop=true;if(dst)s.connect(dst);s.start(0,off||0);return s;}
/* the blades as waveforms (one period: one revolution of that rotor) */
const SND_FEN=(()=>{const th=[];for(let j=0;j<10;j++)th.push(2*Math.PI*j/10+0.15*Math.sin(2*Math.PI*j/10));return th;})();   // the Fenestron's blade angles
function sndRotorWave(c,shape,beat){return sndWave(c,160,k=>{const n=k/4;   // k: harmonics of the rotor speed; n: of the blade passage
  const a=k%4===0?shape(n):beat*Math.exp(-k/6);return [-a,0];});}   // a negative pulse per blade (thickness), a little 1/rev between
function soundStart(){
  if(SND.on||!cfg.sound||typeof AudioContext==='undefined')return;
  const c=new AudioContext();SND.ctx=c;SND.on=true;
  // master: volume ← soft limiter ← the listener's filter (headset, air absorption) ← the mix
  const master=sndGain(c,0,c.destination),comp=c.createDynamicsCompressor();comp.threshold.value=-12;comp.knee.value=8;comp.ratio.value=4;comp.attack.value=0.005;comp.release.value=0.2;comp.connect(master);
  const tone=sndFilt(c,'lowpass',16000,0.5,comp),mix=sndGain(c,0.6,tone);Object.assign(SND,{master,comp,tone,mix});   // (2.8.1: the mix 4 dB down, about the loudness of 2.7 at the same volume)
  const B={};for(const k of ['rot','fen','eng','gbx','air','gnd'])B[k]=sndGain(c,0,mix);SND.B=B;
  const nb=c.createBuffer(1,c.sampleRate*4,c.sampleRate),nd=nb.getChannelData(0),rng=makeRng(5);for(let i=0;i<nd.length;i++)nd[i]=rng()*2-1;SND.nb=nb;
  // main rotor: the blade-passage pulses (rounded; sharp for the slap), the swish pulsing with them
  const gA=sndGain(c,0,B.rot),gS=sndGain(c,0,B.rot);
  SND.rot={a:sndOsc(c,sndRotorWave(c,n=>Math.pow(n,1.5)*Math.exp(-n/1.7),0.12),gA),s:sndOsc(c,sndRotorWave(c,n=>n*Math.exp(-n/9),0.2),gS),gA,gS};   // the thump: most at the 2nd and 3rd blade-passage harmonic (53, 79 Hz); the slap reaches 1 kHz
  const sw=sndGain(c,0,B.rot);sndNoise(c,nb,0.3,sndFilt(c,'bandpass',480,0.6,sw));
  const pulse=sndWave(c,8,n=>[Math.exp(-(n-1)/1.4),0]),lfoG=sndGain(c,0,sw.gain);SND.rot.sw=sw;SND.rot.lfo=sndOsc(c,pulse,lfoG);SND.rot.lfoG=lfoG;
  const wh=sndGain(c,0,B.rot),whL=sndGain(c,0,wh.gain);sndNoise(c,nb,3.6,sndFilt(c,'bandpass',180,0.8,wh));SND.rot.lfo.connect(whL);SND.rot.wh=wh;SND.rot.whL=whL;   // the body: air pushed down, a soft whoosh with every blade
  // Fenestron: ten unevenly spaced blades; the duct's rush
  const fenW=sndWave(c,80,k=>{let re=0,im=0;for(const t of SND_FEN){re+=Math.cos(k*t);im+=Math.sin(k*t);}const P=Math.exp(-Math.pow(k/24,2));return [re*P/10,im*P/10];});
  const fG=sndGain(c,0,B.fen),fLP=sndFilt(c,'lowpass',1500,0.7,fG),dG=sndGain(c,0,B.fen);
  SND.fen={o:sndOsc(c,fenW,fLP),g:fG,lp:fLP,dg:dG};sndNoise(c,nb,1.1,sndFilt(c,'bandpass',1800,1.1,dG));
  /* most of the whine is noise in narrow bands at the blade passage and its double: the blades' turbulent wakes smear the
     tones (pure lines, steady to the hertz, are what made 2.8 ring like metal) */
  SND.fen.nb=[1,2].map(h=>{const g=sndGain(c,0,B.fen),f=sndFilt(c,'bandpass',587*h,6,g);sndNoise(c,nb,0.4+h,f);return {g,f,h};});
  // turbines: whine (a few partials of the gas generator), a narrow hiss an octave up; the exhaust roar
  const engW=sndWave(c,4,k=>[0,[1,0.25,0.07,0.02][k-1]]);   // a smooth whine
  SND.eng=[0,1].map(i=>{const g=sndGain(c,0,B.eng),hg=sndGain(c,0,B.eng),hf=sndFilt(c,'bandpass',1800,7,hg);sndNoise(c,nb,1.7+i*0.9,hf);return {o:sndOsc(c,engW,sndFilt(c,'lowpass',4500,0.7,g)),g,hg,hf};});
  const roar=sndGain(c,0,B.eng);sndNoise(c,nb,2.3,sndFilt(c,'lowpass',240,0.7,roar));SND.roar=roar;
  // main gearbox: three mesh stages (typical of the class; the type's own numbers are not published)
  // (2.8 had pure sines here, rung by the blade passage: a metallic clink. 2.8.1: narrow bands of noise, a whine, quiet)
  SND.gbx=[[705,1],[1062,0.7],[1868,0.45]].map(([f,a],i)=>{const g=sndGain(c,0,B.gbx),fl=sndFilt(c,'bandpass',f,25,g);sndNoise(c,nb,0.9+i*0.7,fl);return {f,a,g,fl};});
  // air: the rush outside, a hiss on the canopy
  const air=sndGain(c,0,B.air),airF=sndFilt(c,'lowpass',600,0.7,air),hiss=sndGain(c,0,B.air);sndNoise(c,nb,0.7,airF);sndNoise(c,nb,3.1,sndFilt(c,'highpass',2800,0.7,hiss));SND.air={g:air,f:airF,h:hiss};
  // skids sliding on the ground
  const scr=sndGain(c,0,B.gnd);sndNoise(c,nb,2.9,sndFilt(c,'bandpass',1100,1.4,scr));SND.scrape=scr;
  // the low-NR horn, in the headset in every view
  const hg=sndGain(c,0,comp);SND.horn={o:sndOsc(c,'square',sndFilt(c,'lowpass',2500,0.7,hg)),g:hg,ph:0};SND.horn.o.frequency.value=1200;
  SND.touchT=S.touch?S.touch.t:null;SND.crash=!!S.crash;SND.rPrev=undefined;SND.vr=0;SND.j=[0,0,0];SND.rng=makeRng(11);
}
/* a one-shot: a skid touching down or the crash (a low thump and a burst of noise) */
function soundHit(k){const c=SND.ctx,t=c.currentTime,g=sndGain(c,0,SND.B.gnd),o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(70,t);o.frequency.exponentialRampToValueAtTime(38,t+0.3);o.connect(g);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.9*k,t+0.008);g.gain.setTargetAtTime(0,t+0.01,0.09);o.start(t);o.stop(t+0.8);
  const ng=sndGain(c,0,SND.B.gnd),s=c.createBufferSource();s.buffer=SND.nb;s.connect(sndFilt(c,'lowpass',k>1.2?2500:700,0.7,ng));ng.gain.setValueAtTime(0.6*k,t);ng.gain.setTargetAtTime(0,t,k>1.2?0.35:0.05);s.start(t,Math.random()*3);s.stop(t+(k>1.2?2:0.4));}
function soundUpdate(dt){
  if(!SND.on)return;const c=SND.ctx,t=c.currentTime,T=0.05,set=(p,v,tc)=>p.setTargetAtTime(v,t,tc||T);
  set(SND.master.gain,cfg.sound?(cfg.volume===undefined?70:cfg.volume)/100:0,0.1);if(!cfg.sound)return;
  /* where we listen: in the cockpit, or at the camera outside (distance, its rate: the Doppler factor) */
  const inside=cfg.view==='cockpit',cp=R3&&R3.cam&&R3.cam.pos?R3.cam.pos:S.pos,r=inside?0:Math.hypot(S.pos[0]-cp[0],S.pos[1]-cp[1],S.pos[2]-cp[2]);
  const vr=SND.rPrev===undefined||!(dt>0)?0:clamp((r-SND.rPrev)/dt,-120,120);SND.rPrev=r;SND.vr+=(vr-SND.vr)*Math.min(1,dt/0.15);
  const D=inside?1:343/(343+SND.vr),near=inside?1:Math.min(1,25/Math.max(r,1));   // 1/r beyond the chase camera's distance
  /* nothing in the air is steady: three slow random wanderings (τ 0.4 s) for the rotor, the Fenestron and its pitch */
  if(dt>0)for(let i=0;i<3;i++){const R=SND.rng,g=(R()+R()+R()-1.5)*2;SND.j[i]+=-SND.j[i]*dt/0.4+Math.sqrt(2*dt/0.4)*g;}const J=SND.j;
  set(SND.tone.frequency,inside?3400:Math.min(16000,16000/(1+r/150)),0.1);   // the headset's muffled highs; air absorbing them with distance
  const M=inside?{rot:1,fen:0.3,eng:0.4,gbx:0.6,air:0.8,gnd:1}:{rot:1,fen:0.8,eng:0.75,gbx:0.05,air:0.4,gnd:0.8};
  for(const k in M)set(SND.B[k].gain,M[k]*near,0.15);
  /* main rotor */
  const nr=Math.max(0,S.rot.Om/H.rotor.Om0),sp=Math.min(nr,1.1),frev=Math.max(0.5,S.rot.Om/(2*Math.PI))*D;
  const load=clamp(S.rot.T/(cfg.mass*9.81),0,1.6),L=sp*sp*(0.3+0.7*load)*sm(0.05,0.25,nr);
  const slap=clamp(sm(-200,-700,S.vs/FPM)*sm(0.04,0.08,S.rot.mu)*sm(0.22,0.15,S.rot.mu)+0.6*S.rot.vrs+0.6*sm(0.30,0.40,S.rot.mu),0,1);   // the wake in the disc: descending at 30 to 90 kt
  for(const o of [SND.rot.a,SND.rot.s])set(o.frequency,frev,0.03);set(SND.rot.lfo.frequency,frev*4,0.03);
  const Lj=L*(1+0.12*clamp(J[0],-2.5,2.5));set(SND.rot.gA.gain,0.45*Lj*(1-0.6*slap));set(SND.rot.gS.gain,0.45*Lj*slap);set(SND.rot.sw.gain,0.07*Lj);set(SND.rot.lfoG.gain,0.05*Lj);set(SND.rot.wh.gain,0.30*Lj);set(SND.rot.whL.gain,0.20*Lj);
  /* Fenestron */
  const ft=clamp(Math.abs(S.fen.T)/3000,0,1.5);
  const ff=Math.max(1,S.rot.Om*H.fen.ratio/(2*Math.PI))*D,fj=1+0.2*clamp(J[1],-2.5,2.5),fon=sp*sp*sm(0.05,0.3,nr);
  set(SND.fen.o.frequency,ff*(1+0.003*clamp(J[2],-2.5,2.5)),0.03);set(SND.fen.g.gain,fon*(0.035+0.08*ft)*fj);set(SND.fen.lp.frequency,700+1300*Math.min(ft,1));set(SND.fen.dg.gain,sp*sp*(0.018+0.035*ft));
  for(const b of SND.fen.nb){set(b.f.frequency,Math.max(20,ff*10*b.h),0.03);set(b.g.gain,fon*(b.h===1?1:0.55)*(0.35+0.7*ft)*fj);}
  /* turbines: whine on N1, roar on power; engine 2 a hair faster (the beat) */
  let pw=0;S.eng.e.forEach((en,i)=>{const n1=Math.max(0,en.N1)/100,p=clamp(en.P/H.eng.top,0,1.2),f=Math.max(1,920*n1*(1+0.0016*i))*D,E=SND.eng[i];pw+=p;
    set(E.o.frequency,f,0.08);set(E.g.gain,sm(0.03,0.25,n1)*(0.022+0.02*n1+0.035*p),0.1);set(E.hf.frequency,Math.max(50,2*f),0.08);set(E.hg.gain,sm(0.03,0.25,n1)*0.025*n1,0.1);});
  set(SND.roar.gain,0.07*pw+0.02*S.eng.e.reduce((a,en)=>a+Math.max(0,en.N1)/100,0),0.15);
  /* main gearbox: mesh tones with the rotor speed, louder with torque */
  const q=clamp(S.eng.fli/10,0,1.3);for(const m of SND.gbx){set(m.fl.frequency,Math.max(20,m.f*nr)*D,0.05);set(m.g.gain,0.25*m.a*sp*(0.3+0.7*q)*sm(0.1,0.4,nr));}
  /* air */
  const V=S.tas,v2=clamp(V*V/(70*70),0,1.4);set(SND.air.g.gain,0.12*v2,0.2);set(SND.air.f.frequency,400+V*12,0.2);set(SND.air.h.gain,inside?0.025*v2:0,0.2);
  /* the ground: sliding, touching down, the crash */
  const vg=mrot(qmat(S.q),S.vb),gs=Math.hypot(vg[0],vg[1]);set(SND.scrape.gain,S.onGround&&gs>0.3?0.12*Math.min(1,gs/6):0,0.05);
  if(S.touch&&S.touch.t!==SND.touchT){SND.touchT=S.touch.t;const v=Math.abs(S.touch.vs||0);if(v>0.25)soundHit(clamp(v/2.5,0.15,1.2));}   // (not the settling of a reset)
  if(S.crash&&!SND.crash)soundHit(1.6);SND.crash=!!S.crash;
  /* the low-NR horn: power on below 97 %, autorotation below 90 %, pulsed */
  const low=S.NR>5&&!S.onGround&&(S.eng.mode==='off'||S.eng.fli<1.5?S.NR<H.nr.minAuto+5:S.NR<H.nr.minPowerOn);
  SND.horn.ph=(SND.horn.ph+dt*4)%1;SND.horn.g.gain.setTargetAtTime(low&&SND.horn.ph<0.5?0.05:0,t,0.01);
}
