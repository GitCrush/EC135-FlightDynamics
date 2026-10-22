"""Headless smoke test: loads index.html in Chromium (SwiftShader WebGL),
takes off with the keyboard, reports state, saves screenshots."""
import asyncio,sys,os,pathlib,tempfile
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=pathlib.Path(tempfile.gettempdir())
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':800})
        errs=[]
        pg.on('console',lambda m: errs.append(f'[{m.type}] {m.text}') if m.type in('error','warning') else None)
        pg.on('pageerror',lambda e: errs.append('PAGEERROR '+str(e)))
        await pg.goto((ROOT/'index.html').as_uri())
        await pg.wait_for_timeout(2500)
        print('\n'.join(errs[:20]) if errs else 'no console errors')
        ok=await pg.evaluate('()=>!!(typeof S!=="undefined"&&S)')
        if not ok: await b.close();return
        info=await pg.evaluate('()=>({t:S.t,nr:S.NR,alt:S.alt,gl:!!R3.gl})')
        print('state',info)
        await pg.mouse.move(489,400)
        await pg.keyboard.down('KeyW');await pg.wait_for_timeout(2500);await pg.keyboard.up('KeyW')
        await pg.wait_for_timeout(3000)
        info=await pg.evaluate('()=>({t:S.t,nr:S.NR,agl:S.hAGL,col:S.ctl.col,ias:S.ias,vs:S.vs,inc:S.incident&&S.incident.id,phi:S.eul[0]*57.3,th:S.eul[1]*57.3,src:IN.raw.src})')
        print('after takeoff',info)
        await pg.screenshot(path=str(OUT/'ec135_cockpit.png'))
        await pg.keyboard.press('Digit2');await pg.wait_for_timeout(800)
        await pg.screenshot(path=str(OUT/'ec135_chase.png'))
        await pg.keyboard.press('Digit3');await pg.wait_for_timeout(800)
        await pg.screenshot(path=str(OUT/'ec135_tower.png'))
        print('\n'.join(errs[:20]) if errs else 'no console errors after flying')
        # graphics: one multisampled context for all modes; auto scales the drawing resolution with the frame time
        # (pixel-bound synthetic frames: their time follows the pixel count), full ignores it, nothing is remembered
        g=await pg.evaluate('''()=>{const r={};const gl0=R3.gl;cfgSet('gfx','auto');drsReset();DRS.t=5;R3.soft=false;GFX.mode=gfxEffective();render(0.02);r.buf0=[R3.canvas.width,R3.canvas.height];
          for(let i=0;i<45*12;i++)drsStep(0.05*DRS.s*DRS.s);render(0.02);r.sLow=DRS.s;r.bufLow=[R3.canvas.width,R3.canvas.height];r.why=GFX.why;
          for(let i=0;i<45*30;i++)drsStep(0.010);render(0.02);r.sBack=DRS.s;
          drsReset();DRS.t=5;for(let i=0;i<45*12;i++)drsStep(0.035);r.sCpu=DRS.s;   // frame time independent of the pixels: one step tried, then held
          cfgSet('gfx','full');for(let i=0;i<45*6;i++)drsStep(0.05*DRS.s*DRS.s);render(0.02);r.bufFull=[R3.canvas.width,R3.canvas.height];r.full=GFX.mode;
          r.sameCtx=R3.gl===gl0;r.aa=R3.gl.getContextAttributes().antialias;r.deriv=R3.info.deriv;r.tiles=R3.tilesDrawn;
          cfgSet('gfx','light');render(0.02);r.light=GFX.mode;cfgSet('gfx','auto');render(0.02);
          let st=null;try{st=localStorage.getItem('ec135fd.gfx')+'/'+localStorage.getItem('ec135fd.gfxAuto');}catch(e){}r.stored=st;return r;}''')
        print('graphics',g)
        bad=not(g['sLow']<=0.61 and g['bufLow'][0]<g['buf0'][0]*0.65 and g['sBack']>=0.99 and 0.89<=g['sCpu']<=1.0 and g['bufFull']==g['buf0'] and g['full']=='full' and g['light']=='light' and g['sameCtx'] and g['aa'] and g['stored']=='auto/null')
        print('graphics resolution scaling FAILED' if bad else 'graphics resolution scaling ok')
        await pg.wait_for_timeout(500)
        print('\n'.join(errs[:20]) if errs else 'no console errors after mode switches')
        # autopilot menu: J opens it, the ALT and HOV tiles engage those modes, + raises the height target, All off, J closes it; U toggles ALT from the keyboard
        await pg.evaluate("()=>{const w=document.getElementById('welcome');if(w)w.style.display='none';uiReset('hover');}")
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Digit1');await pg.keyboard.press('KeyJ');await pg.wait_for_timeout(300)
        op=await pg.evaluate("()=>document.getElementById('apMenu').classList.contains('open')")
        await pg.click('#amMalt');await pg.click('#amMhov');await pg.wait_for_timeout(300)
        a=await pg.evaluate("()=>({alt:AFCS.alt,hov:AFCS.hov,held:AFCS.held,tile:document.getElementById('amMalt').classList.contains('on'),t:AFCS.tAlt,side:document.getElementById('asAlt').classList.contains('on')})")
        await pg.click('#amRalt button[data-d=\"1\"]');await pg.wait_for_timeout(300)
        a2=await pg.evaluate("()=>({t:AFCS.tAlt,val:document.getElementById('amValt').textContent})")
        await pg.click('#amOff');await pg.keyboard.press('KeyJ');await pg.wait_for_timeout(300)
        cl=await pg.evaluate("()=>({open:document.getElementById('apMenu').classList.contains('open'),any:afcsAny()})")
        await pg.keyboard.press('KeyU');await pg.wait_for_timeout(300)
        u=await pg.evaluate("()=>({alt:AFCS.alt,pred:PRED.mode,n:PRED.res?PRED.res.n:0})")
        await pg.keyboard.press('KeyU');await pg.wait_for_timeout(200)
        print('autopilot menu',op,a,a2,cl,u)
        bad=not op or not(a['alt'] and a['hov'] and a['tile'] and a['side']) or not(a2['t']>a['t']+0.5 and a2['val'].endswith('0 ft')) or cl['open'] or cl['any'] or not u['alt'] or u['n']<10
        print('autopilot menu FAILED' if bad else 'autopilot menu ok')
        print('\n'.join(errs[:20]) if errs else 'no console errors after the autopilot menu')
        # predictor: 30 s ahead in cruise from the worker, drawn in the view (band, ghost) without a GL error
        await pg.evaluate("()=>{uiReset('cruise');cfg.view='chase';R3.gl.getError();}");await pg.wait_for_timeout(1500)
        pr=await pg.evaluate("()=>{render(1/60);const e=R3.gl.getError();return {mode:PRED.mode,T:PRED.T,end:+predEnd().toFixed(1),verts:PGL.n/7,ghost:!!predGhost(),glErr:e,ms:Math.round(PRED.ms)};}")
        await pg.evaluate("()=>{uiReset('hover');}");await pg.wait_for_timeout(1200)
        ph=await pg.evaluate("()=>({T:PRED.T,end:+predEnd().toFixed(1)})")
        print('predictor',pr,ph)
        bad=pr['mode']!='worker' or pr['T']!=30 or pr['end']<29 or pr['verts']<100 or pr['glErr']!=0 or ph['T']!=6 or ph['end']<5.5
        print('predictor FAILED' if bad else 'predictor ok')
        # click to fly: hold M, point at the ground ahead, one wheel notch up (25 ft), click; the gold arrows lead, nothing is driven;
        # a right click while holding M clears the target
        await pg.evaluate("()=>{uiReset('hover');cfg.view='cockpit';afcsToggle('hov',true);}");await pg.wait_for_timeout(800)
        box=await pg.evaluate("()=>{const r=R3.canvas.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};}")
        await pg.mouse.move(box['x']+box['w']*0.62,box['y']+box['h']*0.58);await pg.keyboard.down('KeyM');await pg.wait_for_timeout(200)
        await pg.mouse.move(box['x']+box['w']*0.60,box['y']+box['h']*0.56);await pg.mouse.wheel(0,-100);await pg.wait_for_timeout(300)
        aim=await pg.evaluate("()=>({on:AIM.on,pick:aimPick(AIM.x,AIM.y),h:Math.round(aimH()/FT),col:DEV.kbd.col})")
        await pg.mouse.down();await pg.mouse.up();await pg.keyboard.up('KeyM');await pg.wait_for_timeout(1500)
        go=await pg.evaluate("()=>({on:GUIDE.on,h:Math.round(GUIDE.h/FT),d:Math.round(GUIDE.d),ap:afcsAny(),aim:AIM.on,alive:COACH.alive,panel:HUD.panelA,col0:DEV.kbd.col})")
        await pg.keyboard.down('KeyM');await pg.wait_for_timeout(100);await pg.mouse.down(button='right');await pg.mouse.up(button='right');await pg.keyboard.up('KeyM');await pg.wait_for_timeout(200)
        clr=await pg.evaluate("()=>({on:GUIDE.on})")
        print('click to fly',aim,go,clr)
        bad=not aim['on'] or not aim['pick'] or aim['h']!=25 or not go['on'] or go['h']!=25 or go['d']<3 or go['ap'] or go['aim'] or not go['alive'] or go['panel']<0.9 or abs(go['col0']-aim['col'])>1e-6 or clr['on']
        print('click to fly FAILED' if bad else 'click to fly ok')
        print('\n'.join(errs[:20]) if errs else 'no console errors after click to fly')
        # sound: the graph builds and follows the model in every view (the page's own loop drives it) without an error
        snd=await pg.evaluate("async()=>{cfg.sound=true;SND.on=false;soundStart();for(const v of ['cockpit','chase','tower']){cfg.view=v;await new Promise(r=>setTimeout(r,400));}cfg.view='cockpit';return {on:SND.on,state:SND.ctx&&SND.ctx.state,graph:!!(SND.rot&&SND.fen&&SND.gbx&&SND.eng),tone:Math.round(SND.tone.frequency.value)}}")
        print('sound',snd)
        print('sound FAILED' if not(snd['on'] and snd['graph']) else 'sound ok')
        print('\n'.join(errs[:20]) if errs else 'no console errors after the sound')
        # the world (2.9): the four exercises start where they should, trimmed, without a crash, and R repeats one; the time of day
        # and the visibility; the life drawn (cars, birds, smoke)
        wd=await pg.evaluate("""async()=>{cfg.sound=false;const out={};let p0=null;for(const k of ['peak','clearing','hill','highrise']){startExercise(k);p0=S.pos.slice();await new Promise(r=>setTimeout(r,700));const ex=EXERCISES[k].start;   // (the trim flies 2 s from the start point)
            out[k]={d:Math.round(Math.hypot(S.pos[0]-ex[0],S.pos[1]-ex[1])),crash:S.crash||'',kind:cfg.resetKind};}
          keyAction('KeyR');out.repeat=+Math.hypot(S.pos[0]-p0[0],S.pos[1]-p0[1]).toFixed(2);
          cfg.tod=7;cfg.vis=3;R3.gl.getError();render(1/60);out.morning={sun:+(Math.asin(-R3.sun[2])/DEG).toFixed(1),fogK:+(R3.fogK*1000).toFixed(2),glErr:R3.gl.getError()};cfg.tod=11;cfg.vis=12;
          out.life={cars:LIFE.cars.length,birds:LIFE.birds.length,smoke:LIFE.smoke.reduce((a,s)=>a+s.parts.length,0)};return out;}""")
        print('world',wd)
        bad=any(wd[k]['crash'] or wd[k]['d']>120 or wd[k]['kind']!='ex:'+k for k in ['peak','clearing','hill','highrise']) or wd['repeat']>0.5 or not(5<wd['morning']['sun']<25) or wd['morning']['glErr']!=0 or wd['life']['cars']<20 or wd['life']['birds']<20 or wd['life']['smoke']<1
        print('world FAILED' if bad else 'world ok')
        print('\n'.join(errs[:20]) if errs else 'no console errors in the world')
        await b.close()
asyncio.run(main())
