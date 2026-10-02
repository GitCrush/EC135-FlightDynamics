/* ═══════════════ SOUND ═══════════════
   Web Audio, started on the first click. Rotor: band-passed noise with a
   4/rev amplitude modulation from the actual rotor speed and a level
   that follows thrust (blade loading is what you hear). Turbines: a
   whine whose pitch follows N1 and whose level follows power. The
   Fenestron adds a higher-pitched whistle with pedal. */
const SND={ctx:null,on:false};
function soundStart(){
  if(SND.on||!cfg.sound||typeof AudioContext==='undefined')return;
  const c=new AudioContext();SND.ctx=c;SND.on=true;
  const master=c.createGain();master.gain.value=0.5;master.connect(c.destination);SND.master=master;
  const buf=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=buf.getChannelData(0);let s=makeRng(5);for(let i=0;i<d.length;i++)d[i]=s()*2-1;
  const noise=c.createBufferSource();noise.buffer=buf;noise.loop=true;
  const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=180;bp.Q.value=0.8;
  const rg=c.createGain();rg.gain.value=0;noise.connect(bp).connect(rg).connect(master);noise.start();SND.rotor=rg;
  const lfo=c.createOscillator();lfo.type='sine';lfo.frequency.value=26;const lg=c.createGain();lg.gain.value=0;lfo.connect(lg).connect(rg.gain);lfo.start();SND.lfo=lfo;SND.lfoG=lg;
  const eng=[];for(let i=0;i<2;i++){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=900;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1800;const g=c.createGain();g.gain.value=0;o.connect(lp).connect(g).connect(master);o.start();eng.push({o,g});}
  SND.eng=eng;
  const f=c.createOscillator();f.type='triangle';f.frequency.value=600;const fg=c.createGain();fg.gain.value=0;f.connect(fg).connect(master);f.start();SND.fen={o:f,g:fg};
  const wn=c.createBufferSource();wn.buffer=buf;wn.loop=true;const wlp=c.createBiquadFilter();wlp.type='lowpass';wlp.frequency.value=600;const wg=c.createGain();wg.gain.value=0;wn.connect(wlp).connect(wg).connect(master);wn.start();SND.wind={g:wg,f:wlp};
  const hn=c.createOscillator();hn.type='square';hn.frequency.value=1200;const hg=c.createGain();hg.gain.value=0;hn.connect(hg).connect(master);hn.start();SND.horn={o:hn,g:hg,ph:0};
}
function soundUpdate(dt){
  if(!SND.on)return;const c=SND.ctx,t=c.currentTime;
  if(!cfg.sound){SND.master.gain.setTargetAtTime(0,t,0.1);return;}SND.master.gain.setTargetAtTime(0.5,t,0.1);
  const nr=S.NR/100;
  SND.lfo.frequency.setTargetAtTime(H.rotor.N*H.rotor.Om0/(2*Math.PI)*nr,t,0.05);
  const load=clamp(S.rot.T/(cfg.mass*9.81),0,1.6);
  // blade slap: descending through transition, the blades cut their own tip vortices
  const slap=sm(-200,-700,S.vs/FPM)*sm(0.02,0.05,S.rot.mu)*sm(0.16,0.10,S.rot.mu)+0.6*S.rot.vrs;
  SND.rotor.gain.setTargetAtTime(0.05+0.35*load*nr,t,0.05);SND.lfoG.gain.setTargetAtTime(0.03+0.25*load+0.5*slap,t,0.05);
  // airflow noise rises with the square of the airspeed
  const V=S.tas;SND.wind.g.gain.setTargetAtTime(0.12*clamp(V*V/(70*70),0,1.3),t,0.2);SND.wind.f.frequency.setTargetAtTime(400+V*12,t,0.2);
  // low-NR horn: power on below 97 %, autorotation below 90 %, pulsed
  const low=S.NR>5&&!S.onGround&&(S.eng.mode==='off'||S.eng.fli<1.5?S.NR<H.nr.minAuto+5:S.NR<H.nr.minPowerOn);
  SND.horn.ph=(SND.horn.ph+dt*4)%1;SND.horn.g.gain.setTargetAtTime(low&&SND.horn.ph<0.5?0.04:0,t,0.01);
  S.eng.e.forEach((en,i)=>{const p=clamp(en.P/H.eng.top,0,1.2);SND.eng[i].o.frequency.setTargetAtTime(650+en.N1*7,t,0.1);SND.eng[i].g.gain.setTargetAtTime(en.fail||!en.on?0:0.012+0.05*p,t,0.1);});
  SND.fen.o.frequency.setTargetAtTime(500+H.fen.N*H.fen.ratio*H.rotor.Om0/(2*Math.PI)*nr*0.25,t,0.1);
  SND.fen.g.gain.setTargetAtTime(0.01+0.05*clamp(Math.abs(S.fen.T)/3000,0,1),t,0.1);
}
