"""Renders the sound offline: headless Chromium, the page's own sound graph on an OfflineAudioContext,
driven by the model stepping in fast time (the graph's parameters updated every 23 ms, as the page does
every frame). Writes WAV files and spectrograms, prints levels and band energies and checks them.
Run: python3 test/soundshot.py [--before OTHER.html] [scenario ...]
With --before the same scenarios are rendered from another build too (e.g. the previous release), for
listening side by side. Output: $TMPDIR/ec135-sound/ (or --out DIR)."""
import asyncio,base64,pathlib,sys,os,tempfile,json
import numpy as np
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
args=sys.argv[1:];before=None;out=pathlib.Path(tempfile.gettempdir())/'ec135-sound'
if '--before' in args:i=args.index('--before');before=pathlib.Path(args[i+1]).resolve();del args[i:i+2]
solo=None
if '--solo' in args:i=args.index('--solo');solo=args[i+1];del args[i:i+2]
if '--out' in args:i=args.index('--out');out=pathlib.Path(args[i+1]).resolve();del args[i:i+2]
out.mkdir(parents=True,exist_ok=True);SR=44100
COMMON='''()=>{const w=document.getElementById('welcome');if(w)w.style.display='none';if(REPLAY.on)replayStop();UI.paused=false;UI.debrief=null;cfg.mass=2500;cfg.hud=true;
  coachSet('off');afcsOffAll();if(typeof guideReset==='function')guideReset();R3.cam.lockPsi=undefined;R3.cam.chasePos=null;UI.freeze=true;
  window.run=(sec,fn)=>{for(let i=0;i<sec/DT;i++){if(fn)fn(i*DT);inputStep(DT);tutorStep(DT);afcsStep(DT);coachStep(DT);step(DT);}};}'''
# name, seconds, setup, per-step driver (t: seconds into the render)
SCEN=[
 ('cockpit-hover',6,"startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';",''),
 ('chase-hover',6,"startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='chase';",''),
 ('chase-cruise',6,"uiReset('cruise');cfg.view='chase';",''),
 ('cockpit-cruise',6,"uiReset('cruise');cfg.view='cockpit';",''),
 ('descent-slap',7,"uiReset('approach');cfg.view='chase';window.__c=DEV.kbd.col-0.07;","DEV.kbd.col=window.__c;"),
 ('tower-flyby',8,"startExercise('free');placeAt(-430,115,30,0,100);trimNow(4);S.pos[0]=-280;cfg.view='tower';",''),
 ('startup',8,"uiReset('cold');engStart(S.eng);for(const en of S.eng.e)en.startT=12;cfg.view='chase';",''),
 ('landing',6,"startExercise('free');placeAt(0,0,2.0,205*DEG,0);trimNow(6);cfg.view='cockpit';window.__c=DEV.kbd.col-0.035;","DEV.kbd.col=S.onGround?Math.max(0.05,DEV.kbd.col-0.3*DT):window.__c;"),
]
RENDER='''async ([sec,drive])=>{
  const sr=%d,c=new OfflineAudioContext(1,Math.round(sr*sec),sr),su=window.__su||(window.__su=soundUpdate);soundUpdate=()=>{};
  const AC=window.AudioContext;window.AudioContext=function(){return c;};SND.on=false;cfg.sound=true;soundStart();window.AudioContext=AC;if(window.__solo&&SND.B)for(const k in SND.B)if(k!==window.__solo)SND.B[k].disconnect();   // --solo BUS: one source alone
  const dt=128*8/sr,fn=new Function('t',drive||'');let simT=0;const info={slap:0,mu:0,vsMin:0,touch:null};
  cameraUpdate(dt);su(dt);
  for(let k=1;k*dt<sec;k++){const at=k*dt;c.suspend(at).then(()=>{while(simT<at){fn(simT);inputStep(DT);tutorStep(DT);afcsStep(DT);coachStep(DT);step(DT);simT+=DT;}
    cameraUpdate(dt);su(dt);info.mu=Math.max(info.mu,S.rot.mu);info.vsMin=Math.min(info.vsMin,S.vs);if(S.touch)info.touch=S.touch.vs;c.resume();});}
  const buf=await c.startRendering(),d=buf.getChannelData(0),i16=new Int16Array(d.length);let bad=0;
  for(let i=0;i<d.length;i++){const v=d[i];if(!Number.isFinite(v))bad++;i16[i]=Math.max(-32767,Math.min(32767,Math.round((Number.isFinite(v)?v:0)*32767)));}
  let s='';const u8=new Uint8Array(i16.buffer);for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
  soundUpdate=su;SND.on=false;try{SND.ctx=null;}catch(e){}
  return {b64:btoa(s),bad,ias:S.ias/KT,vs:S.vs/FPM,info};}'''%SR
def wav(path,x):
    import wave
    with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(x.astype('<i2').tobytes())
def bands(x):
    f=np.fft.rfftfreq(len(x),1/SR);P=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2
    tot=P.sum()+1e-20;return {f'{a}-{b}':round(10*np.log10(P[(f>=a)&(f<b)].sum()/tot+1e-12),1) for a,b in [(15,60),(60,250),(250,1000),(1000,4000),(4000,16000)]}
def dopp(a,b):   # the frequency ratio that maps the spectrum of b onto that of a best (300-1500 Hz, log power)
    f=np.fft.rfftfreq(len(a),1/SR);La=np.log(np.abs(np.fft.rfft(a*np.hanning(len(a))))**2+1e-9);Lb=np.log(np.abs(np.fft.rfft(b*np.hanning(len(b))))**2+1e-9)
    g=np.linspace(300,1500,4000);A=np.interp(g,f,La);A-=A.mean();best=(-1e9,1)
    for k in np.arange(0.55,1.05,0.0025):B=np.interp(g*k,f,Lb);B-=B.mean();c=float(np.dot(A,B)/np.sqrt(np.dot(A,A)*np.dot(B,B)));best=max(best,(c,k))
    return best[1]
def peakf(x,lo,hi):
    f=np.fft.rfftfreq(len(x),1/SR);P=np.abs(np.fft.rfft(x*np.hanning(len(x))));m=(f>=lo)&(f<hi);return float(f[m][np.argmax(P[m])])
async def render(path,names):
    res={}
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg=await b.new_page(viewport={'width':1280,'height':800});pg.set_default_timeout(300000);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(path.as_uri());await pg.wait_for_timeout(2000)
        for name,sec,setup,drive in SCEN:
            if names and name not in names:continue
            await pg.evaluate(COMMON);await pg.evaluate('(s)=>{window.__solo=s;}',solo);await pg.evaluate('()=>{'+setup+'}')
            r=await pg.evaluate(RENDER,[sec,drive]);x=np.frombuffer(base64.b64decode(r['b64']),dtype='<i2').astype(np.float64)
            res[name]=(x,r)
        await b.close()
    return res,errs
def spectro(path,items):
    import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
    fig,ax=plt.subplots(len(items),3,figsize=(15,2.6*len(items)),squeeze=False,gridspec_kw={'width_ratios':[3,2,2]})
    for (a,lo,w),(title,x) in zip(ax,items):
        a.specgram(x/32767,NFFT=4096,Fs=SR,noverlap=3584,cmap='magma',vmin=-140,vmax=-40);a.set_ylim(0,4000);a.set_title(title,fontsize=9);a.set_ylabel('Hz')
        lo.specgram(x/32767,NFFT=16384,Fs=SR,noverlap=15360,cmap='magma',vmin=-140,vmax=-30);lo.set_ylim(0,400);lo.set_title('0-400 Hz',fontsize=9)
        m=len(x)//2;w.plot(np.arange(SR//2)/SR,x[m:m+SR//2]/32767,lw=0.5);w.set_ylim(-1,1);w.set_title('0.5 s of the waveform',fontsize=9)
    fig.tight_layout();fig.savefig(path,dpi=90);plt.close(fig)
async def main():
    names=set(args);now,errs=await render(ROOT/'index.html',names);old={}
    if before:old,_=await render(before,names)
    bad=0
    for name,(x,r) in now.items():
        rms=20*np.log10(np.sqrt(np.mean((x/32767)**2))+1e-12);pk=np.max(np.abs(x))/32767;wav(out/f'{name}.wav',x)
        line=f'{name:15s} rms {rms:6.1f} dBFS  peak {pk:5.2f}  bands {bands(x)}  NaN {r["bad"]}'
        if name in old:
            xo=old[name][0];wav(out/f'{name}-before.wav',xo);ro=20*np.log10(np.sqrt(np.mean((xo/32767)**2))+1e-12);line+=f'  | before rms {ro:6.1f} bands {bands(xo)}'
            spectro(out/f'{name}.png',[(f'{name} before',xo),(f'{name} 2.8',x)])
        else:spectro(out/f'{name}.png',[(name,x)])
        print(line)
        ok=r['bad']==0 and pk<0.99 and (-40 if name!='startup' else -55)<rms<-6
        if name=='tower-flyby':   # the Fenestron's pitch: higher coming, lower going
            k=dopp(x[:SR*2],x[-SR*2:]);print(f'   Doppler: going away {k:.3f} × the pitch coming (51 m/s past at 62 m: about 0.75)');ok=ok and 0.6<k<0.9
        if name=='cockpit-hover' and 'chase-hover' in now:   # the headset: less above 4 kHz than outside
            ok=ok and bands(x)['4000-16000']<bands(now['chase-hover'][0])['4000-16000']-6
        if name=='landing':print(f'   touchdown sink {r["info"]["touch"]}');ok=ok and r['info']['touch'] is not None
        if name=='descent-slap':print(f'   descent {r["info"]["vsMin"]/0.00508:.0f} fpm, mu {r["info"]["mu"]:.3f}')
        if not ok:bad+=1;print('   FAILED')
    print(errs if errs else 'no page errors');print(f'files in {out}');print('sound checks FAILED' if bad else 'sound checks ok');sys.exit(1 if bad else 0)
asyncio.run(main())
