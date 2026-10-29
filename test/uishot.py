"""Renders the README screenshots into docs/screenshots/ with a headless
Chromium (Playwright, SwiftShader WebGL). Every state is set up in fast
time through the page's own functions, then the frame is frozen
(UI.freeze) and captured. Run: python3 test/uishot.py"""
import asyncio,pathlib,sys
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/'docs'/'screenshots';OUT.mkdir(parents=True,exist_ok=True)
FAKEPAD='''(()=>{const pad={index:0,id:'GameSir G7 Pro (XInput STANDARD GAMEPAD)',mapping:'standard',connected:true,timestamp:0,
  axes:[0.12,-0.02,0.35,-0.18],buttons:Array.from({length:17},(_,i)=>({value:i===0?1:0,pressed:i===0}))};
  navigator.getGamepads=()=>[pad,null,null,null];})();'''
COMMON='''()=>{const w=document.getElementById('welcome');if(w)w.style.display='none';if(REPLAY.on)replayStop();UI.paused=false;UI.debrief=null;for(const k in DEV.keys)DEV.keys[k]=false;HUD.keysT0=-1e9;profileApply('beginner');cfg.motion='off';cfg.mass=2500;cfg.view='cockpit';cfg.apr='off';cfg.aprChin=false;cfg.hud=true;cfg.gfx='full';R3.soft=false;const inc=document.getElementById('inc');inc.textContent='';inc.dataset.t='';HUD.incText='';refreshTexts();cfg.sound=false;cfg.tod=11;cfg.vis=12;cfg.cloud=0.4;
  coachSet('off');COACH.legendT=-1e9;UI.freeze=false;R3.cam.lockPsi=undefined;afcsOffAll();apMenuShow(false);SCOPE.fix=null;guideReset();window.run=(sec,fn)=>{for(let i=0;i<sec/DT;i++){if(fn)fn(i*DT);inputStep(DT);tutorStep(DT);afcsStep(DT);coachStep(DT);step(DT);}};}'''
SHOTS=[
 ('cockpit-hover','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';S.vb[1]+=0.6;run(2);UI.freeze=true;}'''),
 ('approach-view','''()=>{startExercise('free');placeAt(-55,-25,22,24*DEG,18);trimNow(6);cfg.view='cockpit';run(0.5);cfg.apr='on';cameraUpdate(1/30);APR.k=1;APR.ack=true;for(let i=0;i<120;i++)cameraUpdate(1/30);predStep(true);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('approach-view-roof','''()=>{startExercise('roof');placeAt(-212,-372,30,225*DEG,10);trimNow(6);cfg.view='cockpit';run(0.5);cfg.apr='on';cfg.aprChin=true;cameraUpdate(1/30);APR.k=1;APR.ack=true;for(let i=0;i<120;i++)cameraUpdate(1/30);predStep(true);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('approach-hint','''()=>{startExercise('free');placeAt(-55,-25,35,24*DEG,10);trimNow(6);cfg.view='cockpit';run(0.5);for(let i=0;i<60;i++)cameraUpdate(1/30);predStep(true);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('glance-right','''()=>{startExercise('free');placeAt(8,6,4,205*DEG,0);trimNow(6);cfg.view='cockpit';run(0.5);DEV.keys.KeyE=true;for(let i=0;i<60;i++)cameraUpdate(1/30);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('cockpit-panel','''()=>{startExercise('free');placeAt(120,80,2.0,30*DEG,0);trimNow(6);cfg.hud=false;cfg.view='cockpit';run(1);UI.freeze=true;}'''),
 ('downwash-dust','''()=>{startExercise('free');placeAt(22,-157,2.0,30*DEG,0);trimNow(6);cfg.hud=false;cfg.view='orbit';R3.cam.orbit=[-8,-18,-5];R3.cam.orbitAt=[0,0,1.5];R3.cam.orbitFov=55;run(0.3);for(let i=0;i<30;i++)render(1/30);UI.freeze=true;}'''),
 ('downwash-spray','''()=>{startExercise('free');placeAt(-450,520,3.0,30*DEG,0);trimNow(6);cfg.hud=false;cfg.view='orbit';R3.cam.orbit=[-8,-18,-5];R3.cam.orbitAt=[0,0,1.5];R3.cam.orbitFov=55;run(0.3);for(let i=0;i<30;i++)render(1/30);UI.freeze=true;}'''),
 ('chase-hover','''()=>{startExercise('free');cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]+0.75;R3.cam.chasePsi=R3.cam.lockPsi;run(1.5);UI.freeze=true;}'''),
 ('tutor-calm-hover','''()=>{tutorStart(3);tutorSetStep(1);cfg.view='cockpit';run(1);UI.freeze=true;}'''),
 ('coach-cue','''()=>{startExercise('free');cfg.view='cockpit';coachSet('cues');COACH.legendT=-1e9;run(2);S.vb[1]-=2.2;S.vb[0]+=0.6;run(1.4);UI.freeze=true;}'''),
 ('retreating-blade-stall','''()=>{cfg.mass=2910;uiReset('cruise');cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]-0.9;R3.cam.chasePsi=R3.cam.lockPsi;
    AP.on=true;AP.mode='cruise';AP.ias=140;AP.alt=S.alt;AP.hdg=S.eul[2];for(let i=0;i<30/DT;i++){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
    AP.on=false;const b={...IN};for(let i=0;i<1.6/DT;i++){IN.lon=b.lon-0.3;IN.col=b.col;IN.lat=b.lat;IN.ped=b.ped;step(DT);}UI.freeze=true;window.__stall=S.rot.stall;}'''),
 ('autopilot-menu','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';afcsToggle('alt',true);afcsToggle('hov',true);apMenuShow(true);run(3);S.vb[1]+=1.4;S.vb[0]-=0.6;run(0.9);apMenuSync();predStep(true);UI.freeze=true;}'''),
 ('autopilot-hover','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';for(const m of ['alt','hdg','hov'])afcsToggle(m,true);run(3);S.vb[1]+=1.4;S.vb[0]-=0.6;S.om[2]+=0.08;run(0.9);predStep(true);UI.freeze=true;}'''),
 ('autopilot-cruise','''()=>{startExercise('free');uiReset('cruise');cfg.view='cockpit';run(2);for(const m of ['alt','hdg','ias'])afcsToggle(m,true);run(2);afcsAdjust('ias',1);afcsAdjust('hdg',2);afcsAdjust('alt',1);run(2.5);predStep(true);UI.freeze=true;}'''),
 ('predictor-hover','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]-0.25;R3.cam.chasePsi=R3.cam.lockPsi;run(1);run(1.3,()=>{DEV.kbd.lon=0.05;DEV.kbd.lat=0.14;});predStep(true);UI.freeze=true;}'''),
 ('predictor-turn','''()=>{uiReset('cruise');cfg.view='chase';R3.cam.chasePos=null;run(2);run(0.8,()=>{DEV.kbd.lat=0.22;});run(3.2,()=>{DEV.kbd.lat=0;});for(let i=0;i<60;i++)cameraUpdate(1/30);predStep(true);UI.freeze=true;}'''),
 ('predictor-cockpit','''()=>{uiReset('cruise');cfg.view='cockpit';run(2);run(0.8,()=>{DEV.kbd.lat=0.22;DEV.kbd.lon=0.05;});run(3.2,()=>{DEV.kbd.lat=0;DEV.kbd.lon=0;});predStep(true);UI.freeze=true;}'''),
 ('predictor-scope','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';run(1);run(1.3,()=>{DEV.kbd.lon=0.06;DEV.kbd.lat=0.14;});predStep(true);render(0.016);
    const A=scopeSnap();run(0.8,()=>{DEV.kbd.lon=0;DEV.kbd.lat=-0.10;});predStep(true);render(0.016);scopeStep();SCOPE.prev=A;SCOPE.fix=0.42;UI.freeze=true;}'''),
 ('click-to-fly-aim','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';run(1);predStep(true);render(0.016);hudDraw(0.016);AIM.on=true;AIM.locked=true;AIM.hi=3;AIM.x=R3.w*0.60;AIM.y=Math.min(R3.h*0.535,HUD.panelTop-45);render(0.016);AIM.pick=aimPick(AIM.x,AIM.y);UI.freeze=true;}'''),
 ('click-to-fly','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]+0.15;R3.cam.chasePsi=R3.cam.lockPsi;run(1);
    const b=S.eul[2]+0.45;guideSet(S.pos[0]+120*Math.cos(b),S.pos[1]+120*Math.sin(b),3);run(1.2);for(let i=0;i<40;i++)cameraUpdate(1/30);predStep(true);UI.freeze=true;}'''),
 ('click-to-fly-air','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';run(1);
    const b=S.eul[2]+0.22;guideSet(S.pos[0]+260*Math.cos(b),S.pos[1]+260*Math.sin(b),300*FT);run(1.2);predStep(true);UI.freeze=true;}'''),
 ('predictor-landing','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]+0.9;R3.cam.chasePsi=R3.cam.lockPsi;run(1);const c=IN.col-0.07;run(0.8,()=>{DEV.kbd.col=c;DEV.kbd.lat=0.05;});predStep(true);UI.freeze=true;}'''),
 ('replay','''()=>{startExercise('free');cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]+2.4;R3.cam.chasePsi=R3.cam.lockPsi;
    run(4,t=>{DEV.keys.ArrowRight=t>0.5&&t<1.6;});DEV.keys.ArrowRight=false;run(3,t=>{DEV.keys.KeyS=t<1.2;});DEV.keys.KeyS=false;run(4);
    S.incident={id:'hard',t:S.t-3.5,text:'Hard landing'};replayStart();REPLAY.i=Math.max(0,REPLAY.log.length-150);UI.freeze=true;}'''),
 ('hospital-rooftop','''()=>{startExercise('roof');placeAt(-232,-392,32,225*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=225*DEG;R3.cam.chasePsi=R3.cam.lockPsi;run(1);UI.freeze=true;}'''),
 ('scenery-lake','''()=>{startExercise('free');placeAt(-560,330,60,70*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=70*DEG;R3.cam.chasePsi=R3.cam.lockPsi;run(1);UI.freeze=true;}'''),
 ('world-peak','''()=>{startExercise('peak');cfg.hud=false;cfg.view='chase';R3.cam.chasePos=null;run(1);for(let i=0;i<60;i++)cameraUpdate(1/30);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('world-clearing','''()=>{startExercise('free');placeAt(200,-880,4,270*DEG,0);trimNow(4);cfg.hud=false;cfg.view='chase';R3.cam.chasePos=null;run(0.3);for(let i=0;i<60;i++)cameraUpdate(1/30);UI.freeze=true;}'''),
 ('world-town','''()=>{startExercise('free');placeAt(-1950,-1000,80,225*DEG,0);trimNow(4);cfg.hud=false;cfg.view='cockpit';run(0.3);for(let i=0;i<300;i++){R3.time+=0.05;lifeSmoke(0.05);}render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('world-valley','''()=>{startExercise('free');placeAt(560,330,12,10*DEG,0);trimNow(4);cfg.hud=false;cfg.view='cockpit';run(0.3);UI.freeze=true;}'''),
 ('world-lake','''()=>{startExercise('free');placeAt(-600,430,10,40*DEG,0);trimNow(4);cfg.hud=false;cfg.view='chase';R3.cam.chasePos=null;run(0.3);for(let i=0;i<60;i++)cameraUpdate(1/30);R3.time=20;UI.freeze=true;}'''),
 ('world-evening','''()=>{cfg.tod=19;cfg.vis=14;cfg.cloud=0.5;startExercise('free');placeAt(400,-300,150,300*DEG,0);trimNow(4);cfg.hud=false;cfg.view='cockpit';run(0.5);UI.freeze=true;}'''),
 ('world-canopy','''()=>{startExercise('free');placeAt(120,-760,60,0,0);trimNow(4);cfg.hud=false;cfg.view='orbit';R3.cam.orbit=[-25,-10,-30];R3.cam.orbitAt=[25,10,40];R3.cam.orbitFov=70;run(0.3);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('world-fields','''()=>{startExercise('free');placeAt(-200,410,40,45*DEG,0);trimNow(4);cfg.hud=false;cfg.view='orbit';R3.cam.orbit=[-60,-60,-55];R3.cam.orbitAt=[80,80,25];R3.cam.orbitFov=62;run(0.3);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('world-village','''()=>{cfg.tod=16;startExercise('free');placeAt(400,600,60,0,0);trimNow(4);cfg.hud=false;cfg.view='orbit';R3.cam.orbit=[-30,-20,-70];R3.cam.orbitAt=[0,0,60];R3.cam.orbitFov=60;run(0.3);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('world-hamlet','''()=>{cfg.tod=15;startExercise('free');placeAt(720,-300,40,0,0);trimNow(4);cfg.hud=false;cfg.view='orbit';R3.cam.orbit=[-60,40,-35];R3.cam.orbitAt=[30,0,25];R3.cam.orbitFov=60;run(0.3);render(1/60);hudDraw(1/60);UI.freeze=true;}'''),
 ('debrief','''()=>{startExercise('free');cfg.view='cockpit';run(8);
    AP.on=true;AP.mode='hover';AP.auto=false;AP.posN=S.pos[0];AP.posE=S.pos[1];AP.hdg=S.eul[2];apBumpless(AP);const g=terrainH(S.pos[0],S.pos[1]);
    for(const [h,sec] of [[g+1.3+0.3,8],[g+0.5,40]]){AP.alt=h;for(let i=0;i<sec/DT;i++){const o=apStep(DT);IN.col=S.onGround?Math.max(0.05,IN.col-0.3*DT):o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);if(S.onGround&&S.ctl.col<0.1)break;}}
    AP.on=false;DEV.kbd.col=0.05;run(4);sideUpdate(3.5);UI.freeze=true;}'''),
]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=await b.new_context(viewport={'width':1280,'height':800},locale='en-US')
        pg=await ctx.new_page();pg.set_default_timeout(120000);errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((ROOT/'index.html').as_uri());await pg.wait_for_timeout(2000)
        await pg.evaluate("()=>{R3.soft=false;cfg.gfx='full';}");await pg.wait_for_timeout(1500)   # SwiftShader here: no software-rendering notice in the pictures
        if not sys.argv[1:] or 'welcome' in sys.argv[1:]:
            await pg.screenshot(path=str(OUT/'welcome.png'));print('welcome')
        await pg.mouse.move(1200,780)

        only=set(sys.argv[1:])
        for name,js in SHOTS:
            if only and name not in only: continue
            if name.startswith('world-'):   # a fresh page for the heavy world views (a long session's overlay could lag behind its frame)
                await pg.reload();await pg.wait_for_timeout(3000);await pg.evaluate("()=>{R3.soft=false;cfg.gfx='full';}");await pg.wait_for_timeout(1000)
            await pg.evaluate(COMMON);await pg.evaluate(js);await pg.evaluate('()=>{render(1/60);hudDraw(1/60);}');await pg.wait_for_timeout(1500)   # the frame drawn at once: a software renderer's frame can take a second
            await pg.screenshot(path=str(OUT/f'{name}.png'))
            extra=await pg.evaluate('()=>({t:S.t.toFixed(1),agl:S.hAGL.toFixed(1),ias:(S.ias/KT).toFixed(0),stall:window.__stall,hint:COACH.hint,deb:!!UI.debrief})');print(name,extra)
        await b.close()
        if sys.argv[1:] and 'gamepad-panel' not in sys.argv[1:]:
            print(errs if errs else 'no page errors');return
        # gamepad panel with a simulated controller
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=await b.new_context(viewport={'width':1280,'height':800},locale='en-US');pg=await ctx.new_page()
        await pg.add_init_script(FAKEPAD);await pg.goto((ROOT/'index.html').as_uri());await pg.wait_for_timeout(1500)
        await pg.evaluate(COMMON);await pg.evaluate("()=>{startExercise('free');document.getElementById('setup').classList.add('open');}");await pg.wait_for_timeout(500)
        await pg.evaluate('()=>{const su=document.getElementById("setup"),pp=document.getElementById("padPanel");su.scrollTop=pp.offsetTop-300;}');await pg.mouse.move(1200,780);await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(OUT/'gamepad-panel.png'));print('gamepad-panel')
        await b.close()
        print(errs if errs else 'no page errors')
asyncio.run(main())
