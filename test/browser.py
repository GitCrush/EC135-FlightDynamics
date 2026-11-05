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
        await pg.wait_for_timeout(1500);await pg.evaluate("()=>{profileApply('beginner');}")   # (2.16.1) the first start is the hardest level; the checks fly with the aids, as written
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
        yy=await pg.evaluate("()=>Math.min(0.58,(HUD.panelTop-30)/R3.h)")   # (2.12) above the panel: in the hover the approach view lifts it
        await pg.mouse.move(box['x']+box['w']*0.62,box['y']+box['h']*yy);await pg.keyboard.down('KeyM');await pg.wait_for_timeout(200)
        await pg.mouse.move(box['x']+box['w']*0.60,box['y']+box['h']*(yy-0.02));await pg.mouse.wheel(0,-100);await pg.wait_for_timeout(300)
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
        # the approach view (2.12.4): only by key; the hint offers it on the approach after flying away (never on the take-off),
        # and offers the normal view back on a departure (after a landing, from the hover) while it is on
        av=await pg.evaluate('''()=>{cfg.view='cockpit';cfg.apr='off';const r={};const key4=()=>{cfg.apr=cfg.apr==='on'?'off':'on';APR.ack=true;};
          const fly=(sec,agl)=>{let mx=0;const hs=new Set();for(let i=0;i<sec/DT;i++){if(agl!==undefined)AP.alt=terrainH(S.pos[0],S.pos[1])+1.3+agl;const o=apStep(DT);IN.col=AP.land&&S.onGround?Math.max(0.05,IN.col-0.3*DT):o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);if(i%4===3){cameraUpdate(4*DT);mx=Math.max(mx,APR.k);if(APR.hint&&APR.hintT<8)hs.add(APR.hint);}}return {k:+mx.toFixed(2),h:[...hs].join(',')};};
          startExercise('pad');cameraUpdate(0.03);AP.on=true;AP.mode='hover';AP.auto=false;AP.posN=S.pos[0];AP.posE=S.pos[1];AP.hdg=S.eul[2];apBumpless(AP);AP.land=false;
          const t1=fly(20,10),t2=fly(15,40);r.takeoff=[Math.max(t1.k,t2.k),t1.h+t2.h];
          AP.hdg=Math.PI;AP.mode='cruise';AP.ias=70;AP.posN=null;AP.posE=null;fly(30,150);r.armedAway=APR.armed;
          AP.ias=40;fly(20,60);AP.mode='hover';AP.posN=S.pos[0]-150;AP.posE=S.pos[1];AP.vN=0;AP.vE=0;const ap=fly(50,15);r.approach=[ap.k,ap.h];   // the hint, not the view
          key4();fly(6,15);r.on=+APR.k.toFixed(2);r.ackHint=APR.hint&&APR.hintT<8?APR.hint:'';
          const cc=fly(8,22);r.correction=[+APR.k.toFixed(2),cc.h];fly(8,15);
          AP.mode='cruise';AP.ias=45;AP.posN=null;AP.posE=null;const dp=fly(15,40);r.departure=[+APR.k.toFixed(2),dp.h,APR.armed];   // still on (no automatism), the hint offers it back
          key4();fly(4,40);r.off=+APR.k.toFixed(2);
          placeAt(10,10,40,0,0);trimNow(4);AP.on=true;AP.mode='hover';AP.auto=false;AP.posN=S.pos[0];AP.posE=S.pos[1];AP.hdg=S.eul[2];apBumpless(AP);AP.land=false;cameraUpdate(0.03);r.armedAgain=APR.armed;
          const fn=fly(30,3);key4();fly(4,3);r.final=[+APR.k.toFixed(2),fn.h];
          cfg.aprChin=false;render(1/60);hudDraw(1/60);render(1/60);hudDraw(1/60);r.up0=Math.round(HUD.panelUp);cfg.aprChin=true;for(let i=0;i<3;i++){cameraUpdate(1/60);render(1/60);hudDraw(1/60);}r.up=Math.round(HUD.panelUp);r.glErr=R3.gl.getError();cfg.aprChin=false;   // drawn: the panel lifted, the chin windows' pass without a GL error
          AP.alt=terrainH(S.pos[0],S.pos[1])+0.5;AP.land=true;fly(40);const ld=fly(6);r.landed=[+APR.k.toFixed(2),ld.h,APR.armed,S.onGround];r.crash=S.crash||'';
          key4();AP.land=false;const lo=fly(20,10);r.liftoff=[+APR.k.toFixed(2),lo.h];AP.on=false;
          startExercise('free');cameraUpdate(0.03);r.freeArmed=APR.armed;startExercise('clearing');cameraUpdate(0.03);r.clearingArmed=APR.armed;cfg.apr='off';
          return r;}''')
        print('approach view',av)
        bad=(av['takeoff'][0]>0 or 'apr' in av['takeoff'][1] or not av['armedAway'] or av['approach'][0]>0 or 'apr' not in av['approach'][1] or av['on']<0.95 or av['ackHint']
             or av['correction'][0]<0.95 or av['correction'][1] or av['departure'][0]<0.95 or 'dep' not in av['departure'][1] or av['departure'][2] or av['off']>0.2
             or not av['armedAgain'] or 'apr' not in av['final'][1] or av['final'][0]<0.8 or not av['up']>0 or av['up0']!=0 or av['glErr'] or av['landed'][0]<0.95 or 'dep' not in av['landed'][1]
             or av['landed'][2] or not av['landed'][3] or av['crash'] or av['liftoff'][0]>0.3 or av['liftoff'][1] or av['freeArmed'] or not av['clearingArmed'])
        print('approach view FAILED' if bad else 'approach view ok')
        # glances (2.13): E held looks out of the right door window, Q the left; the stick stays the mouse's; released, the head comes back
        await pg.evaluate("()=>{startExercise('free');cfg.view='cockpit';}");await pg.wait_for_timeout(300)
        async def until(cond,ms=12000):   # the software renderer draws a few frames a second (fewer on a busy machine): wait for the head, not a fixed time
            for i in range(ms//100):
                if await pg.evaluate(cond):return True
                await pg.wait_for_timeout(100)
            return False
        await pg.keyboard.down('KeyE');await until("()=>DEV.look.yaw>60*Math.PI/180");gr=await pg.evaluate("()=>({yaw:Math.round(DEV.look.yaw*180/Math.PI),pitch:Math.round(DEV.look.pitch*180/Math.PI),look:DEV.look.on,panel:+HUD.panelA.toFixed(2)})")
        await pg.keyboard.up('KeyE');await until("()=>Math.abs(DEV.look.yaw)<3*Math.PI/180");back=await pg.evaluate("()=>Math.round(Math.abs(DEV.look.yaw)*180/Math.PI)")
        await pg.keyboard.down('KeyQ');await until("()=>DEV.look.yaw<-60*Math.PI/180");gl=await pg.evaluate("()=>Math.round(DEV.look.yaw*180/Math.PI)");await pg.keyboard.up('KeyQ')
        print('glances',gr,back,gl)
        bad=gr['yaw']<55 or gr['pitch']>-15 or gr['look'] or gr['panel']>0.1 or back>5 or gl>-55
        print('glances FAILED' if bad else 'glances ok')
        # the key list (2.13.3): '?' on any layout (German: Shift+ß, code Minus) and F1 toggle it
        kq=await pg.evaluate('''()=>{UI.showKeys=false;const ev=(t,k,c)=>window.dispatchEvent(new KeyboardEvent(t,{key:k,code:c}));
          ev('keydown','?','Minus');const a=UI.showKeys;ev('keyup','?','Minus');ev('keydown','F1','F1');const b=UI.showKeys;ev('keyup','F1','F1');return [a,b];}''')
        print('key list',kq);print('key list FAILED' if kq!=[True,False] else 'key list ok')
        # (2.16.8) the mouse buttons: right held = look around, left click = trim; 'pedals' = the right pedal
        mb=await pg.evaluate('''()=>{const st=DEV.look.stage,ev=(t,b)=>st.dispatchEvent(new MouseEvent(t,{button:b,bubbles:true})),up=b=>window.dispatchEvent(new MouseEvent('mouseup',{button:b}));
          cfg.mouseButtons='look';ev('mousedown',2);const on=DEV.look.on;up(2);const off=!DEV.look.on;
          DEV.mouse.armed=true;HUD.trimT=0;DEV.mouse.vx=0.3;ev('mousedown',0);const trimmed=HUD.trimT>0&&DEV.mouse.vx===0;up(0);
          cfg.mouseButtons='pedals';ev('mousedown',2);const ped=DEV.mouse.r&&!DEV.look.on;up(2);cfg.mouseButtons='look';DEV.mouse.armed=false;return {on,off,trimmed,ped};}''')
        print('mouse buttons',mb);print('mouse buttons FAILED' if mb!={'on':True,'off':True,'trimmed':True,'ped':True} else 'mouse buttons ok')
        # (2.17.0) a gamepad (standard mapping, stubbed): RB trims, the D-pad beeps, LB held + right stick looks, Start pauses and resumes, the curve
        gp=await pg.evaluate('''()=>{const pad={connected:true,index:0,id:'test pad',mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};
          const keep=navigator.getGamepads;navigator.getGamepads=()=>[pad];padPreset('gamepad');DEV.padMap='gamepad';
          const press=(b,v)=>{pad.buttons[b].value=v;pad.buttons[b].pressed=v>0.5;},fr=n=>{for(let i=0;i<n;i++){padPoll();padButtonsStep(1/60);inputStep(1/60);}};
          startExercise('free');uiReset('cruise');UI.paused=false;fr(5);
          HUD.trimT=0;press(5,1);fr(2);press(5,0);fr(2);const trim=HUD.trimT>0;
          const th0=TRIM.th;press(12,1);fr(60);press(12,0);fr(2);const beep=+((th0-TRIM.th)*57.3).toFixed(2);
          press(4,1);pad.axes[2]=0.8;fr(5);const look=DEV.look.on&&DEV.look.yawT>1.5&&Math.abs(IN.raw.lat)<0.01;press(4,0);pad.axes[2]=0;fr(3);const lookOff=!DEV.look.on;
          press(9,1);fr(2);press(9,0);fr(2);const paused=UI.paused;press(9,1);fr(2);press(9,0);fr(2);const resumed=!UI.paused;
          pad.axes[2]=0.5;fr(3);const curved=+IN.raw.lat.toFixed(3);pad.axes[2]=0;fr(3);
          navigator.getGamepads=keep;padPreset('gamepad');return {trim,beep,look,lookOff,paused,resumed,curved};}''')
        print('gamepad',gp);print('gamepad FAILED' if not (gp['trim'] and 2.5<gp['beep']<3.5 and gp['look'] and gp['lookOff'] and gp['paused'] and gp['resumed'] and 0.36<gp['curved']<0.41) else 'gamepad ok')
        # the head stays at the eye point when the lever moves (2.16.5: no motion cues), and the HAPI (2.15)
        mh=await pg.evaluate('''()=>{startExercise('free');uiReset('high');cfg.view='cockpit';const st=1/60,adv=()=>{for(let j=0;j<6;j++){inputStep(DT);step(DT);}cameraUpdate(st);};
          const off=()=>{const e=vadd(S.pos,mrot(qmat(S.q),H.pilot.eye));return Math.hypot(...vsub(R3.cam.pos,e));};
          for(let i=0;i<60;i++)adv();DEV.kbd.col+=0.06;let mx=0;for(let i=0;i<30;i++){adv();mx=Math.max(mx,off());}
          const sig=[];for(const h of [32.3,29.4,26]){placeAt(-300,-14,h,0,0);S.vb[0]=0;cameraUpdate(1/30);sig.push(hapiSignal(R3.cam.pos));}return {head:+(mx*100).toFixed(2),sig,mot:typeof motionStep};}''')
        print('head and HAPI',mh);print('head/HAPI FAILED' if not (mh['head']<0.01 and mh['mot']=='undefined' and mh['sig']==['above','on','below']) else 'head and HAPI ok')
        # the engine start by hand (2.16): brake refuses the start, Shift+B, Shift+1, Shift+2, FLIGHT, rotor at 100 %
        es=await pg.evaluate('''()=>{uiReset('cold');DEV.kbd.col=0.02;const sh=c=>{DEV.keys.ShiftLeft=true;keyAction(c);DEV.keys.ShiftLeft=false;},adv=s=>{for(let i=0;i<s/DT;i++){inputStep(DT);step(DT);}};
          sh('Digit1');const refused=!S.eng.e[0].on&&S.eng.brake;sh('KeyB');sh('Digit1');adv(27);const idle1=S.eng.e[0].on&&S.eng.e[0].startT<=0&&S.eng.e[0].sw==='idle';
          sh('Digit2');adv(27);sh('Digit1');sh('Digit2');adv(45);return {refused,idle1,nr:Math.round(S.NR),sw:S.eng.e.map(e=>e.sw),tot:S.eng.e.map(e=>Math.round(e.TOT))};}''')
        print('engine start',es);print('engine start FAILED' if not (es['refused'] and es['idle1'] and es['nr']>=98 and es['sw']==['flight','flight']) else 'engine start ok')
        # settings kept across a reload, profiles (2.14)
        await pg.evaluate("()=>{if(TUTOR.on)tutorStop();if(REPLAY.on)replayStop();profileApply('intermediate');cfg.mouseTravel=950;settingsSave();}");await pg.wait_for_timeout(300)
        print('saved',await pg.evaluate("()=>({t:TUTOR.on,r:REPLAY.on,pt:PT.on,s:(localStorage.getItem('ec135fd.settings')||'').slice(0,60)})"))
        await pg.reload();await pg.wait_for_timeout(3000)
        ks=await pg.evaluate("()=>({p:cfg.profile,mt:cfg.mouseTravel,w:WIND.spd,coach:UI.coachMode})")
        print('settings kept',ks);print('settings FAILED' if ks!={'p':'intermediate','mt':950,'w':0,'coach':'off'} else 'settings ok')
        # (2.16.5) a travel from the pad fitting of 2.14 to 2.16.4 goes back to 1600 px; one set by hand stays
        await pg.evaluate("()=>{localStorage.setItem('ec135fd.settings',JSON.stringify({v:3,cfg:{mouseTravel:700,mouseCal:true,profile:'beginner'},wind:{dir:0,spd:0,turb:0,gust:0},coach:'cues'}));}")
        await pg.reload();await pg.wait_for_timeout(3000)
        mc=await pg.evaluate("()=>({mt:cfg.mouseTravel,cal:cfg.mouseCal,card:typeof CAL})")
        print('pad fitting undone',mc);print('pad fitting FAILED' if not (mc['mt']==1600 and mc.get('cal') is None and mc['card']=='undefined') else 'pad fitting undone ok')
        await pg.evaluate("()=>{try{localStorage.removeItem('ec135fd.settings');}catch(e){}}")
        await b.close()
asyncio.run(main())
