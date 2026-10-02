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
        await b.close()
asyncio.run(main())
