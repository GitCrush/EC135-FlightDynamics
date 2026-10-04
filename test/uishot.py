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
COMMON='''()=>{const w=document.getElementById('welcome');if(w)w.style.display='none';if(REPLAY.on)replayStop();UI.paused=false;UI.debrief=null;cfg.mass=2500;cfg.view='cockpit';const inc=document.getElementById('inc');inc.textContent='';inc.dataset.t='';HUD.incText='';refreshTexts();cfg.sound=false;
  coachSet('off');COACH.legendT=-1e9;UI.freeze=false;R3.cam.lockPsi=undefined;window.run=(sec,fn)=>{for(let i=0;i<sec/DT;i++){if(fn)fn(i*DT);inputStep(DT);tutorStep(DT);coachStep(DT);step(DT);}};}'''
SHOTS=[
 ('cockpit-hover','''()=>{startExercise('free');placeAt(0,0,3,205*DEG,0);trimNow(6);cfg.view='cockpit';S.vb[1]+=0.6;run(2);UI.freeze=true;}'''),
 ('chase-hover','''()=>{startExercise('free');cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]+0.75;R3.cam.chasePsi=R3.cam.lockPsi;run(1.5);UI.freeze=true;}'''),
 ('tutor-calm-hover','''()=>{tutorStart(3);tutorSetStep(1);cfg.view='cockpit';run(1);UI.freeze=true;}'''),
 ('coach-cue','''()=>{startExercise('free');cfg.view='cockpit';coachSet('cues');COACH.legendT=-1e9;run(2);S.vb[1]-=2.2;S.vb[0]+=0.6;run(1.4);UI.freeze=true;}'''),
 ('retreating-blade-stall','''()=>{cfg.mass=2910;uiReset('cruise');cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]-0.9;R3.cam.chasePsi=R3.cam.lockPsi;
    AP.on=true;AP.mode='cruise';AP.ias=140;AP.alt=S.alt;AP.hdg=S.eul[2];for(let i=0;i<30/DT;i++){const o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}
    AP.on=false;const b={...IN};for(let i=0;i<1.6/DT;i++){IN.lon=b.lon-0.3;IN.col=b.col;IN.lat=b.lat;IN.ped=b.ped;step(DT);}UI.freeze=true;window.__stall=S.rot.stall;}'''),
 ('replay','''()=>{startExercise('free');cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=S.eul[2]+2.4;R3.cam.chasePsi=R3.cam.lockPsi;
    run(4,t=>{DEV.keys.ArrowRight=t>0.5&&t<1.6;});DEV.keys.ArrowRight=false;run(3,t=>{DEV.keys.KeyS=t<1.2;});DEV.keys.KeyS=false;run(4);
    S.incident={id:'hard',t:S.t-3.5,text:'Hard landing'};replayStart();REPLAY.i=Math.max(0,REPLAY.log.length-150);UI.freeze=true;}'''),
 ('hospital-rooftop','''()=>{startExercise('roof');placeAt(-232,-392,32,225*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=225*DEG;R3.cam.chasePsi=R3.cam.lockPsi;run(1);UI.freeze=true;}'''),
 ('scenery-lake','''()=>{startExercise('free');placeAt(-560,330,60,70*DEG,0);trimNow(6);cfg.view='chase';R3.cam.chasePos=null;R3.cam.lockPsi=70*DEG;R3.cam.chasePsi=R3.cam.lockPsi;run(1);UI.freeze=true;}'''),
 ('debrief','''()=>{startExercise('free');cfg.view='cockpit';run(8);
    AP.on=true;AP.mode='hover';AP.auto=false;AP.posN=S.pos[0];AP.posE=S.pos[1];AP.hdg=S.eul[2];apBumpless(AP);const g=terrainH(S.pos[0],S.pos[1]);
    for(const [h,sec] of [[g+1.3+0.3,8],[g+0.5,40]]){AP.alt=h;for(let i=0;i<sec/DT;i++){const o=apStep(DT);IN.col=S.onGround?Math.max(0.05,IN.col-0.3*DT):o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);if(S.onGround&&S.ctl.col<0.1)break;}}
    AP.on=false;DEV.kbd.col=0.05;run(4);sideUpdate(3.5);UI.freeze=true;}'''),
]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=await b.new_context(viewport={'width':1280,'height':800},locale='en-US')
        pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto((ROOT/'index.html').as_uri());await pg.wait_for_timeout(2000)
        if not sys.argv[1:] or 'welcome' in sys.argv[1:]:
            await pg.screenshot(path=str(OUT/'welcome.png'));print('welcome')
        await pg.mouse.move(1200,780)

        only=set(sys.argv[1:])
        for name,js in SHOTS:
            if only and name not in only: continue
            await pg.evaluate(COMMON);await pg.evaluate(js);await pg.wait_for_timeout(1200)
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
