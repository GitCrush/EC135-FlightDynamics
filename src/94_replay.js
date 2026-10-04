/* ═══════════════ REPLAY ═══════════════
   The 20 s log is the flight recorder; after an incident it freezes. The
   replay plays it back through the same renderer and HUD: the loop swaps
   the live state for a state rebuilt from a log record, so every
   instrument, the rotor and the shadow show what was recorded. Scrub with
   the arrow keys or the timeline, Space plays, Esc returns to the live
   aircraft, which has been paused meanwhile. */
const REPLAY={on:false,log:null,i:0,play:false,speed:1,acc:0,live:null,inc:null};
function replayStart(){
  if(!S.log||S.log.length<10)return;
  REPLAY.log=S.log.slice();REPLAY.live=S;REPLAY.on=true;REPLAY.play=false;REPLAY.inc=S.incident?S.incident.t:null;
  // start at the incident, 4 s before it, else at the beginning
  let i0=0;if(REPLAY.inc!==null){const t0=REPLAY.inc-4;i0=Math.max(0,REPLAY.log.findIndex(r=>r.t>=t0));}
  REPLAY.i=i0;UI.paused=true;UI.replayPaused=true;if(HUD.aoaMap)HUD.aoaMap.fill(NaN);
}
function replayStop(){if(!REPLAY.on)return;REPLAY.on=false;S=REPLAY.live;if(HUD.aoaMap)HUD.aoaMap.fill(NaN);if(UI.replayPaused){UI.paused=false;UI.replayPaused=false;}}
function replayKey(code){
  if(!REPLAY.on)return false;
  if(code==='KeyL'||code==='KeyQ'){replayStop();return true;}
  if(code==='Space'){REPLAY.play=!REPLAY.play;return true;}
  if(code==='ArrowLeft'){REPLAY.i=Math.max(0,REPLAY.i-(DEV.keys.ShiftLeft?30:3));REPLAY.play=false;return true;}
  if(code==='ArrowRight'){REPLAY.i=Math.min(REPLAY.log.length-1,REPLAY.i+(DEV.keys.ShiftLeft?30:3));REPLAY.play=false;return true;}
  if(code==='Home'){REPLAY.i=0;return true;}
  if(code==='End'){REPLAY.i=REPLAY.log.length-1;return true;}
  if(code==='Digit1'||code==='Digit2'||code==='Digit3')return false;
  return true;   // swallow everything else
}
/* A view state from a record: what the HUD and the renderer read. */
function replayState(r){
  const L=REPLAY.live;
  const q=qfromEuler(r.phi*DEG,r.th*DEG,r.psi*DEG);
  const eng=Object.assign({},L.eng,{fli:r.fli,mode:r.mode||L.eng.mode});
  const rot=Object.assign({},L.rot,{vrs:r.vrs,stall:r.stall,ge:r.ge,mu:r.mu,lam0:r.lam0,psi:r.rpsi,beta:[r.b0,r.b1,r.b2,r.b3],Om:r.nr/100*H.rotor.Om0,aoa:r.aoa||L.rot.aoa});
  const fen=Object.assign({},L.fen,{stall:r.fen});
  const st={...L,q,eul:[r.phi*DEG,r.th*DEG,r.psi*DEG],om:[r.p*DEG,r.q*DEG,r.r*DEG],pos:[r.n,r.e,r.d],vb:[r.u,r.vy,r.w],
    ias:r.ias*KT,tas:r.ias*KT,vs:r.vs*FPM,alt:-r.d,hAGL:r.agl,NR:r.nr,eng,rot,fen,ctl:{col:r.col,lon:r.lon,lat:r.lat,ped:r.ped},
    Pload:r.P,gear:{contact:r.cont,loads:L.gear.loads},nz:r.nz,t:r.t,crash:r.crash?L.crash:'',incident:null,replay:true};
  return st;
}
function replayFrame(dt){
  if(!REPLAY.on)return;
  if(REPLAY.play){REPLAY.acc+=dt*REPLAY.speed*LOG_HZ;while(REPLAY.acc>=1){REPLAY.acc-=1;if(REPLAY.i<REPLAY.log.length-1)REPLAY.i++;else REPLAY.play=false;}}
  S=replayState(REPLAY.log[REPLAY.i]);
}
function replayAfter(){if(REPLAY.on)S=REPLAY.live;}
/* timeline on the overlay */
function replayDraw(x,W,Hh){
  if(!REPLAY.on)return;
  const L=REPLAY.log,n=L.length,t0=L[0].t,t1=L[n-1].t,dtT=Math.max(t1-t0,1);
  const bx=W/2-260,by=Hh/2+120,bw=520;   // between the horizon and the controls box
  x.fillStyle='rgba(13,12,10,0.8)';x.fillRect(bx-12,by-26,bw+24,52);
  x.fillStyle='#2a2620';x.fillRect(bx,by,bw,8);
  if(REPLAY.inc!==null){const px=bx+(REPLAY.inc-t0)/dtT*bw;x.fillStyle=HUD_COL.hot;x.fillRect(px-1,by-6,2,20);}
  const px=bx+(L[REPLAY.i].t-t0)/dtT*bw;x.fillStyle=HUD_COL.amber;x.fillRect(px-2,by-4,4,16);
  x.textAlign='left';x.font='bold 13px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.amber;x.fillText('REPLAY',bx,by-12);
  x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.textAlign='right';
  x.fillText(`${(L[REPLAY.i].t-t0).toFixed(1)} / ${dtT.toFixed(1)} s   ← → scrub · Space play · L back`,bx+bw,by-12);
}
