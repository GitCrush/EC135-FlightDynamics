/* ═══════════════ HUD ═══════════════
   Drawn on a 2D canvas over the 3D view. The horizon, pitch ladder and
   flight path marker are projected with the same matrix as the scene,
   so they sit on the real horizon. The rotor-state map is the
   helicopter's version of the tyre-usage display: angle of attack over
   the disc, binned by azimuth as the blades sweep past, so retreating
   blade stall, the reversed-flow region and a VRS breakdown show up
   where they happen on the disc. */
const HUD={c:null,x:null,aoaMap:null,incT:0,incText:'',incId:''};
const HUD_COL={ink:'#e8e2d6',mute:'#8a8274',amber:'#ffb300',hot:'#ff3b1f',ice:'#6fd3e0',ok:'#7ad36f',panel:'rgba(13,12,10,0.62)'};
function hudInit(canvas){HUD.c=canvas;HUD.x=canvas.getContext('2d');HUD.aoaMap=new Float32Array(24*8).fill(NaN);}
function aoaColor(a,st){const d=a*RAD;if(isNaN(d))return '#222';
  if(d<-2)return 'rgb(60,110,190)';if(d<3)return 'rgb(70,140,120)';if(d<7)return 'rgb(90,170,80)';if(d<10)return 'rgb(190,190,60)';if(d<st)return 'rgb(230,150,40)';return 'rgb(240,50,30)';}
function hudDraw(dt){
  const x=HUD.x,c=HUD.c,W=R3.w,Hh=R3.h;if(c.width!==W||c.height!==Hh){c.width=W;c.height=Hh;}
  x.clearRect(0,0,W,Hh);if(!cfg.hud)return;
  x.font='13px "Arial Narrow",Roboto Condensed,sans-serif';x.textBaseline='middle';
  const [phi,th,psi]=S.eul,rt=H.rotor,st=S.rot;
  const cockpit=cfg.view==='cockpit';
  /* ---- horizon, pitch ladder, flight path marker (cockpit) ---- */
  if(cockpit){
    x.lineWidth=1.5;x.strokeStyle='rgba(232,226,214,0.85)';
    const hp=(bear,el)=>project(vadd(R3.cam.pos,[Math.cos(bear)*Math.cos(el)*4000,Math.sin(bear)*Math.cos(el)*4000,-Math.sin(el)*4000]));
    for(const el of [-20,-10,-5,0,5,10,20]){const a=hp(psi-0.30,el*DEG),b=hp(psi+0.30,el*DEG);if(!a||!b)continue;
      x.beginPath();if(el===0){const k=(b[1]-a[1])/(b[0]-a[0]);x.moveTo(a[0]-2*W,a[1]-k*2*W);x.lineTo(b[0]+2*W,b[1]+k*2*W);x.lineWidth=2.5;x.strokeStyle=HUD_COL.amber;}
      else{x.strokeStyle='rgba(232,226,214,0.85)';const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];x.moveTo(m[0]+(a[0]-m[0])*0.5,m[1]+(a[1]-m[1])*0.5);x.lineTo(m[0]+(b[0]-m[0])*0.5,m[1]+(b[1]-m[1])*0.5);x.lineWidth=1;x.fillStyle=HUD_COL.ink;x.fillText(String(el),m[0]+(b[0]-m[0])*0.55,m[1]+(b[1]-m[1])*0.55);}
      x.stroke();}
    // hover attitude mark on the ladder while the tutor teaches the stick: nose 3° up, right skid 4° low
    if(TUTOR.on&&(TUTOR.showTrim||(LESSONS[TUTOR.li].steps[TUTOR.si]||{}).tether)){const a=hp(psi-0.12,3*DEG),b=hp(psi+0.12,3*DEG);if(a&&b){x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.setLineDash([6,4]);x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();x.setLineDash([]);x.fillStyle=HUD_COL.ice;x.textAlign='left';x.fillText(T_('Schwebelage','hover attitude'),b[0]+6,b[1]);}}
    // aircraft reference: fixed on the screen where the 6° down cockpit line of sight lands the waterline
    const ref=project(vadd(R3.cam.pos,mrot(qmat(S.q),[1000,0,0])));
    if(ref){x.strokeStyle=HUD_COL.amber;x.lineWidth=2;x.beginPath();x.moveTo(ref[0]-40,ref[1]);x.lineTo(ref[0]-14,ref[1]);x.lineTo(ref[0]-7,ref[1]+7);x.lineTo(ref[0],ref[1]);x.lineTo(ref[0]+7,ref[1]+7);x.lineTo(ref[0]+14,ref[1]);x.lineTo(ref[0]+40,ref[1]);x.stroke();}
    if(cfg.fpm){const vN=mrot(qmat(S.q),S.vb);const sp=vlen(vN);
      if(sp>4){const f=project(vadd(R3.cam.pos,vscl(vN,3000/sp)));if(f){x.strokeStyle=HUD_COL.ok;x.lineWidth=2;x.beginPath();x.arc(f[0],f[1],7,0,7);x.moveTo(f[0]-7,f[1]);x.lineTo(f[0]-18,f[1]);x.moveTo(f[0]+7,f[1]);x.lineTo(f[0]+18,f[1]);x.moveTo(f[0],f[1]-7);x.lineTo(f[0],f[1]-14);x.stroke();}}}
  }
  /* ---- cockpit coaming: the airframe reference the eye actually uses ---- */
  if(cockpit){
    x.fillStyle='#17150f';
    x.beginPath();x.moveTo(0,Hh);x.lineTo(0,Hh*0.86);x.quadraticCurveTo(W*0.5,Hh*0.80,W,Hh*0.86);x.lineTo(W,Hh);x.closePath();x.fill();
    x.fillStyle='#2a2620';x.fillRect(0,Hh*0.86-3,W,3);
  }
  /* ---- heading tape ---- */
  {const cx=W/2,y=22;x.fillStyle=HUD_COL.panel;x.fillRect(cx-170,4,340,36);x.strokeStyle=HUD_COL.ink;x.lineWidth=1;x.fillStyle=HUD_COL.ink;x.textAlign='center';
    const hd=((psi*RAD)%360+360)%360;
    for(let d=-60;d<=60;d+=10){const deg=Math.round(hd/10)*10+d;const px=cx+(deg-hd)*2.8;if(Math.abs(px-cx)>165)continue;const big=deg%30===0;x.beginPath();x.moveTo(px,32);x.lineTo(px,big?24:28);x.stroke();
      if(big){const lab=((deg%360)+360)%360;x.fillText(lab===0?'N':lab===90?'E':lab===180?'S':lab===270?'W':String(lab/10),px,15);}}
    x.fillStyle=HUD_COL.amber;x.beginPath();x.moveTo(cx,34);x.lineTo(cx-5,42);x.lineTo(cx+5,42);x.fill();
    x.font='bold 16px "Arial Narrow",sans-serif';x.fillStyle='#000';x.fillRect(cx-22,42,44,20);x.fillStyle=HUD_COL.ink;x.fillText(String(Math.round(hd)).padStart(3,'0'),cx,52);
    // wind: arrow from where it blows, relative to the nose
    const w=S.wind,ws=Math.hypot(w[0],w[1])/KT;if(ws>0.5){const from=Math.atan2(-w[1],-w[0])-psi;x.save();x.translate(cx+200,24);x.rotate(from);x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(0,-14);x.lineTo(0,10);x.moveTo(-5,4);x.lineTo(0,10);x.lineTo(5,4);x.stroke();x.restore();x.fillStyle=HUD_COL.ice;x.font='12px "Arial Narrow",sans-serif';x.fillText(ws.toFixed(0)+' kt',cx+200,48);}
  }
  /* ---- airspeed / altitude boxes ---- */
  x.font='13px "Arial Narrow",sans-serif';
  const box=(bx,by,label,val,unit,sub)=>{x.fillStyle=HUD_COL.panel;x.fillRect(bx,by,110,64);x.textAlign='left';x.fillStyle=HUD_COL.mute;x.fillText(label,bx+8,by+12);x.font='bold 30px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ink;x.fillText(val,bx+8,by+36);x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText(unit,bx+8+x.measureText(val).width*2.3,by+40);if(sub)x.fillText(sub,bx+8,by+56);x.font='13px "Arial Narrow",sans-serif';};
  const gs=Math.hypot(...mrot(qmat(S.q),S.vb).slice(0,2))/KT;
  box(12,Hh/2-90,'IAS',String(Math.round(S.ias/KT)||0),'kt','GS '+(Math.round(gs)||0)+' kt   TAS '+(Math.round(S.tas/KT)||0));
  const ra=S.hAGL/FT;
  box(W-122,Hh/2-90,ra<250?'RAD ALT':'ALT',String(Math.round(ra<250?ra:S.alt/FT)||0),'ft',(S.vs/FPM>=0?'+':'')+(Math.round(S.vs/FPM)||0)+' fpm   ALT '+(Math.round(S.alt/FT)||0)+' ft');
  // vertical speed bar
  {const bx=W-16,cy=Hh/2+20;x.fillStyle=HUD_COL.panel;x.fillRect(bx-6,cy-80,12,160);const v=clamp(S.vs/FPM/2000,-1,1);x.fillStyle=v>0?HUD_COL.ok:S.rot.vrs>0.3?HUD_COL.hot:HUD_COL.amber;x.fillRect(bx-4,cy,8,-v*78);x.strokeStyle=HUD_COL.mute;x.beginPath();x.moveTo(bx-8,cy);x.lineTo(bx+8,cy);x.stroke();}
  /* ---- NR and FLI arcs ---- */
  const arc=(cx,cy,r,v0,v1,val,bands,label,fmt)=>{x.lineWidth=7;const a0=-225*DEG,a1=45*DEG,ang=v=>a0+(clamp(v,v0,v1)-v0)/(v1-v0)*(a1-a0);
    for(const [lo,hi,col] of bands){x.strokeStyle=col;x.beginPath();x.arc(cx,cy,r,ang(lo),ang(hi));x.stroke();}
    x.strokeStyle=HUD_COL.ink;x.lineWidth=3;const a=ang(val);x.beginPath();x.moveTo(cx+Math.cos(a)*(r-12),cy+Math.sin(a)*(r-12));x.lineTo(cx+Math.cos(a)*(r+8),cy+Math.sin(a)*(r+8));x.stroke();
    x.textAlign='center';x.fillStyle=HUD_COL.mute;x.fillText(label,cx,cy+r-2);x.font='bold 22px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ink;x.fillText(fmt,cx,cy-2);x.font='13px "Arial Narrow",sans-serif';};
  {const cx=70,cy=Hh-80;x.fillStyle=HUD_COL.panel;x.fillRect(8,Hh-150,260,142);
    const auto=S.eng.mode==='off'||S.eng.fli<1.5;
    const nb=auto?[[80,85,HUD_COL.hot],[85,110,HUD_COL.ok],[110,120,HUD_COL.hot]]:[[80,90,HUD_COL.hot],[90,97,HUD_COL.amber],[97,104,HUD_COL.ok],[104,106,HUD_COL.amber],[106,120,HUD_COL.hot]];
    arc(cx,cy,42,80,120,S.NR,nb,'NR %',S.NR.toFixed(1));
    const fb=S.eng.mode==='oei'?[[0,10,HUD_COL.ok],[10,11.5,HUD_COL.amber],[11.5,12.5,HUD_COL.hot]]:[[0,10,HUD_COL.ok],[10,11,HUD_COL.amber],[11,12.5,HUD_COL.hot]];
    arc(cx+120,cy,42,0,12.5,S.eng.fli,fb,'FLI',S.eng.fli.toFixed(1));
    x.textAlign='left';x.fillStyle=S.eng.mode==='twin'?HUD_COL.mute:HUD_COL.hot;x.fillText(S.eng.mode.toUpperCase()+(S.eng.limit?'  '+S.eng.limit:'')+'   '+(S.Pload/1e3).toFixed(0)+' / '+(S.Pavail/1e3).toFixed(0)+' kW   '+S.m.toFixed(0)+' kg',16,Hh-16);
    if(S.eng.mode==='off'&&S.NR<5){x.fillStyle=HUD_COL.amber;x.fillText('E  start engines',16,Hh-160);}
    // limit lamps
    const lamps=[['VRS',st.vrs>0.35],['STALL',st.stall>0.2],['FEN',S.fen.stall>0.5],['GE',st.ge<0.95],['Mdd',st.Mtip>rt.Mdd]];
    let ly=Hh-140;for(const [n,on] of lamps){x.fillStyle=on?(n==='GE'?HUD_COL.ice:HUD_COL.hot):'rgba(138,130,116,0.35)';x.fillText(n,236,ly);ly+=17;}
  }
  /* ---- rotor-state map: angle of attack over the disc, binned by azimuth ---- */
  if(cfg.rotorDisc){const cx=W-92,cy=Hh-92,r=72;x.fillStyle=HUD_COL.panel;x.fillRect(W-176,Hh-176,168,168);
    const NA=24,NE=rt.Ne,map=HUD.aoaMap;
    for(let k=0;k<rt.N;k++){const ps=st.psi+2*Math.PI*k/rt.N;const bin=((Math.round(ps/(2*Math.PI)*NA)%NA)+NA)%NA;for(let j=0;j<NE;j++)map[bin*NE+j]=st.aoa[k]?st.aoa[k][j]:NaN;}
    const stallDeg=rt.aStall*RAD;
    // screen angle of azimuth psi (nose up on the map): psi + 90° for a clockwise rotor, 90° - psi otherwise
    const scr=ps=>rt.s>0?ps+Math.PI/2:Math.PI/2-ps, ccw=rt.s<0;
    for(let b=0;b<NA;b++){const a0=scr((b-0.5)/NA*2*Math.PI),a1=scr((b+0.5)/NA*2*Math.PI);
      for(let j=0;j<NE;j++){const r0=r*(rt.r[j]-rt.dr/2)/rt.R,r1=r*(rt.r[j]+rt.dr/2)/rt.R;x.fillStyle=aoaColor(map[b*NE+j],stallDeg);x.beginPath();x.arc(cx,cy,r1,a0,a1,ccw);x.arc(cx,cy,r0,a1,a0,!ccw);x.closePath();x.fill();}}
    x.strokeStyle=HUD_COL.ink;x.lineWidth=1;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();
    // nose mark, direction of the relative wind, inflow
    x.fillStyle=HUD_COL.amber;x.beginPath();x.moveTo(cx,cy-r-2);x.lineTo(cx-5,cy-r-10);x.lineTo(cx+5,cy-r-10);x.fill();
    const va=vsub(S.vb,S.windB);const vh=Math.hypot(va[0],va[1]);if(vh>1){const a=Math.atan2(va[1],va[0]);const L=clamp(vh/40,0,1)*r*0.8;x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.sin(a)*L,cy-Math.cos(a)*L);x.stroke();}
    x.textAlign='left';x.fillStyle=HUD_COL.mute;x.fillText('disc AoA',W-170,Hh-166);x.fillText('λ '+st.lam0.toFixed(3)+'  μ '+st.mu.toFixed(2),W-170,Hh-14);
    x.textAlign='right';x.fillStyle=st.stall>0.2?HUD_COL.hot:HUD_COL.mute;x.fillText('stall '+(st.stall*100).toFixed(0)+' %',W-14,Hh-14);
    if(st.vrs>0.2){x.fillStyle=HUD_COL.hot;x.textAlign='center';x.font='bold 15px "Arial Narrow",sans-serif';x.fillText('VRS '+(st.vrs*100).toFixed(0)+' %',cx,cy);x.font='13px "Arial Narrow",sans-serif';}
  }
  /* ---- controls and the hover drift vector ---- */
  {const cx=W/2-70,cy=Hh-60;x.fillStyle=HUD_COL.panel;x.fillRect(cx-40,cy-40,190,80);
    x.strokeStyle=HUD_COL.mute;x.lineWidth=1;x.strokeRect(cx-30,cy-30,60,60);x.beginPath();x.moveTo(cx,cy-30);x.lineTo(cx,cy+30);x.moveTo(cx-30,cy);x.lineTo(cx+30,cy);x.stroke();
    x.fillStyle=HUD_COL.mute;x.beginPath();x.arc(cx+TRIM.lat*28,cy-TRIM.lon*28,2.5,0,7);x.fill();   // the trim stick
    if(TUTOR.on&&TUTOR.showTrim){const tx=cx+TUTOR.trim.lat*28,ty=cy-TUTOR.trim.lon*28;x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(tx-6,ty);x.lineTo(tx+6,ty);x.moveTo(tx,ty-6);x.lineTo(tx,ty+6);x.stroke();}
    x.fillStyle=HUD_COL.amber;x.beginPath();x.arc(cx+S.ctl.lat*28,cy-S.ctl.lon*28,4,0,7);x.fill();
    x.fillStyle='#000';x.fillRect(cx+40,cy-30,10,60);x.fillStyle=HUD_COL.ok;x.fillRect(cx+40,cy+30,10,-S.ctl.col*60);
    x.fillStyle='#000';x.fillRect(cx+60,cy+22,80,8);x.fillStyle=HUD_COL.amber;x.fillRect(cx+100+S.ctl.ped*40-3,cy+20,6,12);
    x.fillStyle=HUD_COL.mute;x.textAlign='left';x.fillText('COL '+(S.ctl.col*100).toFixed(0)+'%',cx+60,cy-24);x.fillText('PED '+(S.ctl.ped*100).toFixed(0)+'%',cx+60,cy+8);x.fillText(IN.raw.src==='mouse'?'mouse':IN.raw.src==='pad'?'gamepad':(cfg.mouse&&!DEV.mouse.armed?T_('Maus: klicken','mouse: click'):'keys'),cx+60,cy-8);
    if(cfg.hoverAssist){x.fillStyle=HUD_COL.ice;x.fillText('HOVER ASSIST',cx-30,cy-36);}
    // skid loads while on the ground: which corner carries the aircraft (slope landings, rollover)
    if(S.gear.contact>0&&S.gear.loads){const W4=S.m*9.81/4;const pos=[[cx+126,cy-36],[cx+137,cy-36],[cx+126,cy-27],[cx+137,cy-27]];
      x.fillStyle=HUD_COL.mute;x.font='11px "Arial Narrow",sans-serif';x.fillText('skids',cx+122,cy-12);x.font='13px "Arial Narrow",sans-serif';
      S.gear.loads.slice(0,4).forEach((L,i)=>{const k=clamp(L/(2*W4),0,1);x.fillStyle=k>0.8?HUD_COL.hot:k<0.1?'rgba(138,130,116,0.35)':HUD_COL.ok;x.fillRect(pos[i][0],pos[i][1],9,7);});}
    // drift vector: ground velocity relative to the nose, 10 px per m/s
    const vN=mrot(qmat(S.q),S.vb),cps=Math.cos(psi),sps=Math.sin(psi);const vx=vN[0]*cps+vN[1]*sps,vy=-vN[0]*sps+vN[1]*cps;const sp=Math.hypot(vx,vy);
    {const dx=cx+190,dy=cy;x.strokeStyle=HUD_COL.mute;x.lineWidth=1;x.beginPath();x.arc(dx,dy,30,0,7);x.stroke();
      const sat3=sp>3, k=sat3?30/sp:10;                               // 10 px per m/s inside, saturated at the ring beyond 3 m/s
      x.strokeStyle=sp<0.5?HUD_COL.ok:sat3?HUD_COL.amber:HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(dx,dy);x.lineTo(dx+vy*k,dy-vx*k);x.stroke();
      x.fillStyle=HUD_COL.mute;x.fillText(sat3?`${(sp/KT).toFixed(0)} kt`:'drift',dx-12,dy+42);}
  }
  /* ---- attitude numbers (chase/tower) ---- */
  if(!cockpit){x.textAlign='center';x.fillStyle=HUD_COL.mute;x.fillText(`pitch ${(th*RAD).toFixed(0)}°  roll ${(phi*RAD).toFixed(0)}°`,W/2,70);}
  /* ---- tutor panel and highlights ---- */
  if(TUTOR.on){
    const L=LESSONS[TUTOR.li],st=L.steps[TUTOR.si];
    const rects={hdg:[W/2-172,2,344,62],ias:[10,Hh/2-92,114,68],ra:[W-124,Hh/2-92,114,68],nrfli:[6,Hh-152,264,146],fli:[132,Hh-134,116,110],nr:[12,Hh-134,116,110],
      disc:[W-178,Hh-178,172,172],ctl:[W/2-112,Hh-102,194,84],col:[W/2-36,Hh-96,22,72],ped:[W/2-14,Hh-42,92,18],stick:[W/2-104,Hh-94,68,68],drift:[W/2+86,Hh-94,68,68],horizon:[W/2-70,Hh/2-70,140,90]};
    const pulse=0.55+0.45*Math.sin(S.t*4);x.strokeStyle=`rgba(255,179,0,${pulse})`;x.lineWidth=2.5;
    for(const id of (st.hl||[])){const r=rects[id];if(r)x.strokeRect(r[0],r[1],r[2],r[3]);}
    const bw=Math.min(W-40,640),bx=W/2-bw/2,by=68;x.font='15px "Arial Narrow",sans-serif';
    const lines=wrapText(x,T_(st.text[0],st.text[1]),bw-28);const bh=lines.length*20+64;
    x.fillStyle='rgba(13,12,10,0.86)';x.fillRect(bx,by,bw,bh);x.strokeStyle=HUD_COL.amber;x.lineWidth=1;x.strokeRect(bx,by,bw,bh);
    x.textAlign='left';x.fillStyle=HUD_COL.amber;x.font='bold 13px "Arial Narrow",sans-serif';
    x.fillText(`${T_('Lektion','Lesson')} ${TUTOR.li+1}/${LESSONS.length} · ${T_(L.title[0],L.title[1])}   ·   ${T_('Schritt','Step')} ${TUTOR.si+1}/${L.steps.length}`,bx+14,by+16);
    x.fillStyle=HUD_COL.ink;x.font='15px "Arial Narrow",sans-serif';lines.forEach((l,i)=>x.fillText(l,bx+14,by+40+i*20));
    if(TUTOR.prog>0&&TUTOR.passed<=0){x.fillStyle='#2a2620';x.fillRect(bx+14,by+bh-18,bw-28,6);x.fillStyle=HUD_COL.ice;x.fillRect(bx+14,by+bh-18,(bw-28)*TUTOR.prog,6);}
    x.fillStyle=HUD_COL.mute;x.font='11px "Arial Narrow",sans-serif';x.textAlign='right';x.fillText(st.manual?T_('N weiter · B zurück · Q beendet den Tutor','N next · B back · Q quits the tutor'):T_('B zurück · N überspringen · Q beendet den Tutor','B back · N skips · Q quits the tutor'),bx+bw-12,by+bh-8);
    if(TUTOR.passed>0||TUTOR.lessonDone){x.textAlign='center';x.font='bold 22px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ok;
      x.fillText(TUTOR.lessonDone?T_('Lektion abgeschlossen – N für die nächste','Lesson complete – N for the next one'):T_('✓ Gut','✓ Good'),W/2,by+bh+26);}
  }
  /* ---- incident banner ---- */
  if(S.incident&&S.incident.t!==HUD.incT){HUD.incT=S.incident.t;HUD.incText=S.incident.text;HUD.incId=S.incident.id;HUD.incShow=S.t;}
  if(HUD.incText&&S.t-HUD.incShow<10){x.textAlign='center';x.font='14px "Arial Narrow",sans-serif';const lines=wrapText(x,HUD.incText,Math.min(W-80,760));
    const bh=lines.length*18+16,by0=TUTOR.on?Hh/2+60:80;x.fillStyle=HUD.incId==='crash'?'rgba(255,59,31,0.85)':'rgba(255,179,0,0.85)';x.fillRect(W/2-Math.min(W-80,760)/2-10,by0,Math.min(W-80,760)+20,bh);x.fillStyle='#0d0c0a';
    lines.forEach((l,i)=>x.fillText(l,W/2,by0+16+i*18));}
  replayDraw(x,W,Hh);coachDraw(x,W,Hh);
  if(UI.debrief&&S.t-UI.debrief.t<14&&!TUTOR.on){const d=UI.debrief,bw=300,bh=d.rows.length*20+46,bx=W/2-bw/2,by=Hh/2-bh/2-40;
    x.fillStyle='rgba(13,12,10,0.88)';x.fillRect(bx,by,bw,bh);x.strokeStyle=HUD_COL.ice;x.lineWidth=1;x.strokeRect(bx,by,bw,bh);
    x.textAlign='left';x.fillStyle=HUD_COL.ice;x.font='bold 14px "Arial Narrow",sans-serif';x.fillText(d.title,bx+14,by+18);x.font='13px "Arial Narrow",sans-serif';
    d.rows.forEach(([k,v],i)=>{x.fillStyle=HUD_COL.mute;x.textAlign='left';x.fillText(k,bx+14,by+42+i*20);x.fillStyle=HUD_COL.ink;x.textAlign='right';x.fillText(v,bx+bw-14,by+42+i*20);});}
  if(UI.showKeys){const de=cfg.lang==='de';const K=de?[['Maus','Klick in die Sicht fängt sie als Knüppel; Tasten links/rechts = Pedale'],['C · Mitteltaste','halten und umschauen'],['Esc','Maus freigeben'],['Rad · W S','Kollektiv'],['A D','Pedale'],['Pfeile','Knüppel'],['T','Trimm auf die jetzige Lage'],['Shift + Pfeile','Trimm verstellen (Beep)'],['Y','zurück zur Schwebetrimmung'],['E','Triebwerke starten/abstellen'],['H','Hover Assist'],['V','Autopilot fliegt vor'],['K','Coach: aus / Hinweise / Hinweise + Stimme'],['1 2 3','Cockpit · Verfolger · Tower'],['F','Flugwegmarker'],['P · Leertaste','Pause'],['R','Reset wiederholen'],['G','Triebwerksausfall'],['L','Replay der letzten 20 s'],['X','CSV-Export'],['N B Q','Tutor weiter · zurück · Ende'],['?','diese Liste']]
      :[['Mouse','a click into the view captures it as the stick; buttons left/right = pedals'],['C · middle button','hold and look around'],['Esc','release the mouse'],['Wheel · W S','collective'],['A D','pedals'],['Arrows','stick'],['T','trim to the present attitude'],['Shift + arrows','beep trim'],['Y','back to the hover trim'],['E','engines start/stop'],['H','hover assist'],['V','autopilot demonstration'],['K','coach: off / cues / cues + voice'],['1 2 3','cockpit · chase · tower'],['F','flight path marker'],['P · Space','pause'],['R','repeat reset'],['G','engine failure'],['L','replay of the last 20 s'],['X','CSV export'],['N B Q','tutor next · back · quit'],['?','this list']];
    const bw=420,bh=K.length*18+40,bx=W/2-bw/2,by=Hh/2-bh/2-30;x.fillStyle='rgba(13,12,10,0.9)';x.fillRect(bx,by,bw,bh);x.strokeStyle=HUD_COL.amber;x.strokeRect(bx,by,bw,bh);
    x.font='13px "Arial Narrow",sans-serif';K.forEach(([k,v],i)=>{x.textAlign='right';x.fillStyle=HUD_COL.amber;x.fillText(k,bx+110,by+26+i*18);x.textAlign='left';x.fillStyle=HUD_COL.ink;x.fillText(v,bx+124,by+26+i*18);});}
  // mouse stick: a small cross shows the virtual stick around the centre of the view; without capture, say so
  if(cfg.mouse&&!REPLAY.on){
    if(DEV.mouse.armed){const cx0=W/2,cy0=Hh/2-40;const sx=cx0+DEV.mouse.vx*110,sy=cy0+DEV.mouse.vy*110;
      x.strokeStyle='rgba(232,226,214,0.25)';x.lineWidth=1;x.strokeRect(cx0-110,cy0-110,220,220);
      x.strokeStyle='rgba(255,179,0,0.85)';x.lineWidth=1.5;x.beginPath();x.arc(sx,sy,7,0,7);x.moveTo(sx-12,sy);x.lineTo(sx-4,sy);x.moveTo(sx+4,sy);x.lineTo(sx+12,sy);x.moveTo(sx,sy-12);x.lineTo(sx,sy-4);x.moveTo(sx,sy+4);x.lineTo(sx,sy+12);x.stroke();}
    else if(DEV.mouse.on&&!UI.paused){x.textAlign='center';x.font='13px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.amber;x.fillText(T_('Klick in die Sicht fängt die Maus als Knüppel – Esc gibt sie frei','Click into the view to capture the mouse as the stick – Esc releases it'),W/2,Hh*0.86-70);}
  }
  if(DEV.look.on){x.textAlign='center';x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText(T_('Umschauen – loslassen kehrt zur Sicht nach vorn zurück, der Knüppel bleibt, wo er war','Looking around – release returns the view forward, the stick stays where it was'),W/2,Hh*0.86-52);}
  if(UI.apDemo&&!REPLAY.on){x.textAlign='center';x.font='bold 15px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ice;x.fillText(T_('AUTOPILOT FLIEGT – V gibt dir die Steuer zurück','AUTOPILOT FLYING – V hands the controls back'),W/2,Hh*0.86-52);}
  if(UI.paused&&!REPLAY.on){x.textAlign='center';x.font='bold 24px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.amber;x.fillText(T_('PAUSE','PAUSED'),W/2,Hh/2-120);x.font='13px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText(T_('P oder Klick in die Sicht','P or click into the view'),W/2,Hh/2-100);}
  if(S.crash){x.textAlign='center';x.fillStyle='rgba(255,59,31,0.9)';x.fillRect(W/2-190,Hh/2-24,380,54);x.fillStyle='#0d0c0a';x.font='bold 20px "Arial Narrow",sans-serif';x.fillText(S.crash,W/2,Hh/2-4);x.font='13px "Arial Narrow",sans-serif';x.fillText(T_('R = Neustart an derselben Stelle · L = Replay der letzten 20 s','R = restart at the same place · L = replay of the last 20 s'),W/2,Hh/2+18);}
  if(typeof SND!=='undefined'&&!SND.on&&cfg.sound&&!(document.getElementById('welcome')&&document.getElementById('welcome').style.display!=='none')){x.textAlign='center';x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText(T_('Klick in die Sicht schaltet den Ton ein','Click into the view to enable sound'),W/2,Hh*0.86-10);}
}
function wrapText(x,text,maxW){const words=text.split(' ');const lines=[];let cur='';for(const w of words){const t=cur?cur+' '+w:w;if(x.measureText(t).width>maxW){lines.push(cur);cur=w;}else cur=t;}if(cur)lines.push(cur);return lines;}
