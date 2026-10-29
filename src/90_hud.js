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
/* the control indicator (centre of its stick box) and the plan view (centre, radius) at the bottom centre */
function hudCtlPos(W,Hh){return [W/2-(cfg.predict?150:70),Hh-60];}
function hudPlanPos(W,Hh){return [W/2+108,Hh-86,72];}
/* the height profile right of the plan view, as wide as the room up to the rotor-state map allows (none below 80 px) */
function hudProfRect(W,Hh){const [cx,cy,R]=hudPlanPos(W,Hh),x0=cx+R+14,right=cfg.rotorDisc?W-182:W-10,w=Math.min(170,right-x0);return w>=80?[x0,cy-R-8,w,2*R+16]:null;}
/* The cockpit's instrument panel is 89_panel.js (2.6.1). In the cockpit view the trainer's screens (control
   positions, plan view and profile, rotor state) sit in its bezels and are drawn here inside its scale. */
/* (2.14) Outside the cockpit the bottom group (rotor speed and FLI, the controls, plan view and profile, the
   rotor-state map) is laid out for 1000 px and scaled down below that; it overlapped in narrower windows. */
function hudSB(W){return cfg.view==='cockpit'?1:Math.min(1,W/1000);}
function hudCtlFrame(W,Hh){const L=PANEL.lay;if(L)return {cx:L.ctl.cx,cy:L.ctl.cy,s:L.s};const s=hudSB(W),c=hudCtlPos(W/s,Hh/s);return {cx:c[0],cy:c[1],s};}
/* ---- rotor-state map: angle of attack over the disc, binned by azimuth, centred at cx, cy (a 168 px box) ---- */
function hudDisc(x,cx,cy){const rt=H.rotor,st=S.rot,r=72;x.save();x.font='13px "Arial Narrow",sans-serif';x.textBaseline='middle';x.fillStyle=HUD_COL.panel;x.fillRect(cx-84,cy-84,168,168);
    const NA=24,NE=rt.Ne,map=HUD.aoaMap;
    for(let k=0;k<rt.N;k++){const ps=st.psi+2*Math.PI*k/rt.N;const bin=((Math.round(ps/(2*Math.PI)*NA)%NA)+NA)%NA;for(let j=0;j<NE;j++)map[bin*NE+j]=st.aoa[k]?st.aoa[k][j]:NaN;}
    const stallDeg=rt.aStall*RAD;
    // screen angle of azimuth psi (nose up on the map): psi + 90° for a clockwise rotor, 90° - psi otherwise
    const scr=ps=>rt.s>0?ps+Math.PI/2:Math.PI/2-ps, ccw=rt.s<0;
    for(let b=0;b<NA;b++){const a0=scr((b-0.5)/NA*2*Math.PI),a1=scr((b+0.5)/NA*2*Math.PI);
      for(let j=0;j<NE;j++){const r0=r*rt.rin[j]/rt.R,r1=r*rt.rout[j]/rt.R;x.fillStyle=aoaColor(map[b*NE+j],stallDeg);x.beginPath();x.arc(cx,cy,r1,a0,a1,ccw);x.arc(cx,cy,r0,a1,a0,!ccw);x.closePath();x.fill();}}
    x.strokeStyle=HUD_COL.ink;x.lineWidth=1;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();
    // nose mark, direction of the relative wind, inflow
    x.fillStyle=HUD_COL.amber;x.beginPath();x.moveTo(cx,cy-r-2);x.lineTo(cx-5,cy-r-10);x.lineTo(cx+5,cy-r-10);x.fill();
    const va=vsub(S.vb,S.windB);const vh=Math.hypot(va[0],va[1]);if(vh>1){const a=Math.atan2(va[1],va[0]);const L=clamp(vh/40,0,1)*r*0.8;x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.sin(a)*L,cy-Math.cos(a)*L);x.stroke();}
    x.textAlign='left';x.fillStyle=HUD_COL.mute;x.fillText('disc AoA',cx-78,cy-74);x.fillText('λ '+st.lam0.toFixed(3)+'  μ '+st.mu.toFixed(2),cx-78,cy+78);
    x.textAlign='right';x.fillStyle=st.stall>0.2?HUD_COL.hot:HUD_COL.mute;x.fillText('stall '+(st.stall*100).toFixed(0)+' %',cx+78,cy+78);
    if(st.vrs>0.2){x.fillStyle=HUD_COL.hot;x.textAlign='center';x.font='bold 15px "Arial Narrow",sans-serif';x.fillText('VRS '+(st.vrs*100).toFixed(0)+' %',cx,cy);x.font='13px "Arial Narrow",sans-serif';}
  x.restore();}
/* ---- the control positions: stick box, collective, pedals, the autopilot's hands, skid loads, centred at the stick box ---- */
function hudCtl(x,cx,cy){x.save();x.font='13px "Arial Narrow",sans-serif';x.textBaseline='middle';x.fillStyle=HUD_COL.panel;x.fillRect(cx-40,cy-40,190,80);
    x.strokeStyle=HUD_COL.mute;x.lineWidth=1;x.strokeRect(cx-30,cy-30,60,60);x.beginPath();x.moveTo(cx,cy-30);x.lineTo(cx,cy+30);x.moveTo(cx-30,cy);x.lineTo(cx+30,cy);x.stroke();
    x.fillStyle=HUD_COL.mute;x.beginPath();x.arc(cx+TRIM.lat*28,cy-TRIM.lon*28,2.5,0,7);x.fill();   // the trim stick
    if(TUTOR.on&&TUTOR.showTrim){const tx=cx+TUTOR.trim.lat*28,ty=cy-TUTOR.trim.lon*28;x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(tx-6,ty);x.lineTo(tx+6,ty);x.moveTo(tx,ty-6);x.lineTo(tx,ty+6);x.stroke();}
    x.fillStyle=HUD_COL.amber;x.beginPath();x.arc(cx+S.ctl.lat*28,cy-S.ctl.lon*28,4,0,7);x.fill();
    x.fillStyle='#000';x.fillRect(cx+40,cy-30,10,60);x.fillStyle=HUD_COL.ok;x.fillRect(cx+40,cy+30,10,-S.ctl.col*60);
    x.fillStyle='#000';x.fillRect(cx+60,cy+22,80,8);x.fillStyle=HUD_COL.amber;x.fillRect(cx+100+S.ctl.ped*40-3,cy+20,6,12);
    x.fillStyle=HUD_COL.mute;x.textAlign='left';if(!AFCS.held.col)x.fillText('COL '+(S.ctl.col*100).toFixed(0)+'%',cx+60,cy-24);if(!AFCS.held.ped)x.fillText('PED '+(S.ctl.ped*100).toFixed(0)+'%',cx+60,cy+8);   // the autopilot's own marks replace them on the controls it drives
    x.fillText(IN.raw.src==='mouse'?'mouse':IN.raw.src==='pad'?'gamepad':(cfg.mouse&&!DEV.mouse.armed?'mouse: click':'keys'),cx+60,cy-8);
    if(cfg.hoverAssist){x.fillStyle=HUD_COL.ice;x.fillText('HOVER ASSIST',cx-30,cy-36);}
    afcsDrawHands(x,cx,cy);   // the autopilot's hands on the controls (91_assist.js)
    // skid loads while on the ground: which corner carries the aircraft (slope landings, rollover)
    if(S.gear.contact>0&&S.gear.loads){const W4=S.m*9.81/4;const pos=[[cx+126,cy-36],[cx+137,cy-36],[cx+126,cy-27],[cx+137,cy-27]];
      x.fillStyle=HUD_COL.mute;x.font='11px "Arial Narrow",sans-serif';x.fillText('skids',cx+122,cy-12);x.font='13px "Arial Narrow",sans-serif';
      S.gear.loads.slice(0,4).forEach((L,i)=>{const k=clamp(L/(2*W4),0,1);x.fillStyle=k>0.8?HUD_COL.hot:k<0.1?'rgba(138,130,116,0.35)':HUD_COL.ok;x.fillRect(pos[i][0],pos[i][1],9,7);});}
  x.restore();}
/* ---- the plan view and the profile (87_predict.js), or without the predictor the hover drift vector (10 px per m/s, saturated beyond 3 m/s) ---- */
function hudNav(x,px,py,pr,pf){const psi=S.eul[2];x.save();x.font='13px "Arial Narrow",sans-serif';x.textBaseline='middle';
    if(cfg.predict){predDrawPlan(x,px,py,pr);if(pf)predDrawProfile(x,pf[0],pf[1],pf[2],pf[3]);else predDrawHeightBar(x,px,py,pr);}
    else{const vN=mrot(qmat(S.q),S.vb),cps=Math.cos(psi),sps=Math.sin(psi);const vx=vN[0]*cps+vN[1]*sps,vy=-vN[0]*sps+vN[1]*cps;const sp=Math.hypot(vx,vy);
      const dx=px,dy=py;x.strokeStyle=HUD_COL.mute;x.lineWidth=1;x.beginPath();x.arc(dx,dy,30,0,7);x.stroke();
      const sat3=sp>3, k=sat3?30/sp:10;
      x.strokeStyle=sp<0.5?HUD_COL.ok:sat3?HUD_COL.amber:HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(dx,dy);x.lineTo(dx+vy*k,dy-vx*k);x.stroke();
      x.fillStyle=HUD_COL.mute;x.fillText(sat3?`${(sp/KT).toFixed(0)} kt`:'drift',dx-12,dy+42);}
    x.restore();}
/* where the instruments are (screen pixels), for the tutor's highlights: the bottom row, or the panel's screens in the cockpit */
function hudRects(W,Hh){const L=PANEL.lay,f=L?L.s:1,sc=r=>r&&r.map(v=>v*f);
  const by=L?Math.min(Hh/2-92,HUD.panelTop-86):Hh/2-92,hz=cfg.view==='cockpit'&&R3.cam.f?project(vadd(R3.cam.pos,[Math.cos(S.eul[2])*4000,Math.sin(S.eul[2])*4000,0])):null;   // (2.12) the boxes above a lifted panel; the horizon's highlight where the horizon is
  const top={hdg:[W/2-172,2,344,62],ias:[10,by,114,68],ra:[W-124,by,114,68],horizon:hz?[W/2-70,clamp(hz[1],60,Hh-100)-45,140,90]:[W/2-70,Hh/2-70,140,90]};
  if(L){const c=[L.ctl.cx,L.ctl.cy],p=L.nav.plan,v=L.cpds.vemd;
    return Object.assign(top,{nrfli:sc([v.x-4,v.y-4,v.w+8,v.h+8]),fli:sc([v.x,v.y,v.w*0.55,v.h*0.6]),nr:sc([v.x+v.w*0.5,v.y,v.w*0.5,v.h*0.6]),disc:L.rot?sc([L.rot.cx-86,L.rot.cy-86,172,172]):null,
      ctl:sc([c[0]-42,c[1]-42,194,84]),col:sc([c[0]+34,c[1]-36,22,72]),ped:sc([c[0]+56,c[1]+18,92,18]),stick:sc([c[0]-34,c[1]-34,68,68]),drift:sc([p.cx-p.R-10,p.cy-p.R-10,2*p.R+20,2*p.R+20]),profile:sc(L.nav.prof)});}
  const sB=hudSB(W),Wb=W/sB,Hb=Hh/sB,c0=hudCtlPos(Wb,Hb),pl=hudPlanPos(Wb,Hb),bs=r=>r&&r.map(v=>v*sB);{const W=Wb,Hh=Hb;   // (2.14) the bottom group's rectangles in its scale
  return Object.assign(top,Object.fromEntries(Object.entries({nrfli:[6,Hh-152,264,146],fli:[132,Hh-134,116,110],nr:[12,Hh-134,116,110],disc:[W-178,Hh-178,172,172],ctl:[c0[0]-42,Hh-102,194,84],col:[c0[0]+34,Hh-96,22,72],ped:[c0[0]+56,Hh-42,92,18],stick:[c0[0]-34,Hh-94,68,68],
    drift:cfg.predict?[pl[0]-pl[2]-10,pl[1]-pl[2]-10,2*pl[2]+20,2*pl[2]+20]:[c0[0]+156,Hh-94,68,68],profile:hudProfRect(W,Hh)}).map(([k,r])=>[k,bs(r)])));}}
function hudDraw(dt){
  const x=HUD.x,c=HUD.c,W=R3.w,Hh=R3.h,k=Math.min(2,typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1),cw=Math.round(W*k),ch=Math.round(Hh*k);   // the overlay at the screen's density: sharp text
  if(c.width!==cw||c.height!==ch){c.width=cw;c.height=ch;}
  x.setTransform(k,0,0,k,0,0);HUD.k=k;x.clearRect(0,0,W,Hh);
  predTrendStep(dt);   // (2.13.2) the vertical speed in 6 s, for the VSI and the HUD (87_predict.js)
  hapiDraw(x);   // (2.15) the approach path indicator at the field pad (85_render.js), with or without the HUD
  frameDraw2D(x);   // (2.13) the frame: the horizon against it shows the attitude (89_panel.js)
  if(cfg.view==='cockpit')panelDraw2D(x,W,Hh,k);else{HUD.panelA=0;HUD.panelTop=Hh;HUD.panelUp=0;PANEL.lay=null;}   // the panel is the cockpit, with or without the HUD (89_panel.js)
  if(!cfg.hud)return;
  x.font='13px "Arial Narrow",Roboto Condensed,sans-serif';x.textBaseline='middle';
  const [phi,th,psi]=S.eul,rt=H.rotor,st=S.rot;
  const cockpit=cfg.view==='cockpit';
  const sB=hudSB(W),Wb=W/sB,Hb=Hh/sB;   // (2.14) the bottom group's scale outside the cockpit
  const hb=cockpit&&HUD.panelA>0.5?HUD.panelTop+2:Hh-160*sB;   // the hints' line: above the panel in the cockpit, above the bottom group outside (was 86 % of the height, on the controls in a low window)
  HUD.slotT=cockpit?68:80;HUD.slotB=hb-4;   // (2.13.3) the boards' stacks (hudSlotT, hudSlotB)
  /* ---- horizon, pitch ladder, flight path marker (cockpit), above the panel ---- */
  if(cockpit){x.save();x.beginPath();x.rect(0,0,W,HUD.panelTop+(HUD.panelA>0.5?0:Hh));x.clip();
    x.lineWidth=1.5;x.strokeStyle='rgba(232,226,214,0.85)';
    const hp=(bear,el)=>project(vadd(R3.cam.pos,[Math.cos(bear)*Math.cos(el)*4000,Math.sin(bear)*Math.cos(el)*4000,-Math.sin(el)*4000]));
    for(const el of [-20,-10,-5,0,5,10,20]){const a=hp(psi-0.30,el*DEG),b=hp(psi+0.30,el*DEG);if(!a||!b)continue;
      x.beginPath();if(el===0){const k=(b[1]-a[1])/(b[0]-a[0]);x.moveTo(a[0]-2*W,a[1]-k*2*W);x.lineTo(b[0]+2*W,b[1]+k*2*W);x.lineWidth=2.5;x.strokeStyle=HUD_COL.amber;}
      else{x.strokeStyle='rgba(232,226,214,0.85)';const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];x.moveTo(m[0]+(a[0]-m[0])*0.5,m[1]+(a[1]-m[1])*0.5);x.lineTo(m[0]+(b[0]-m[0])*0.5,m[1]+(b[1]-m[1])*0.5);x.lineWidth=1;x.fillStyle=HUD_COL.ink;x.fillText(String(el),m[0]+(b[0]-m[0])*0.55,m[1]+(b[1]-m[1])*0.55);}
      x.stroke();}
    // hover attitude mark on the ladder while the tutor teaches the stick: nose 3° up
    if(TUTOR.on&&(TUTOR.showTrim||(LESSONS[TUTOR.li].steps[TUTOR.si]||{}).tether)){const a=hp(psi-0.12,3*DEG),b=hp(psi+0.12,3*DEG);if(a&&b){x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.setLineDash([6,4]);x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke();x.setLineDash([]);x.fillStyle=HUD_COL.ice;x.textAlign='left';x.fillText('hover attitude',b[0]+6,b[1]);}}
    // aircraft reference: where the body's forward axis lands (the waterline); it moves with the head
    const ref=project(vadd(R3.cam.pos,mrot(qmat(S.q),[1000,0,0])));
    if(ref){x.strokeStyle=HUD_COL.amber;x.lineWidth=2;x.beginPath();x.moveTo(ref[0]-40,ref[1]);x.lineTo(ref[0]-14,ref[1]);x.lineTo(ref[0]-7,ref[1]+7);x.lineTo(ref[0],ref[1]);x.lineTo(ref[0]+7,ref[1]+7);x.lineTo(ref[0]+14,ref[1]);x.lineTo(ref[0]+40,ref[1]);x.stroke();}
    if(cfg.fpm){const vN=mrot(qmat(S.q),S.vb);const sp=vlen(vN);
      if(sp>4){const f=project(vadd(R3.cam.pos,vscl(vN,3000/sp)));if(f){x.strokeStyle=HUD_COL.ok;x.lineWidth=2;x.beginPath();x.arc(f[0],f[1],7,0,7);x.moveTo(f[0]-7,f[1]);x.lineTo(f[0]-18,f[1]);x.moveTo(f[0]+7,f[1]);x.lineTo(f[0]+18,f[1]);x.moveTo(f[0],f[1]-7);x.lineTo(f[0],f[1]-14);x.stroke();}}}

  x.restore();}
  /* (until 1.9 a painted coaming stood in for the airframe here; the 3D cockpit draws it now) */
  /* ---- heading tape ---- */
  {const cx=W/2,y=22;x.fillStyle=HUD_COL.panel;x.fillRect(cx-170,4,340,36);x.strokeStyle=HUD_COL.ink;x.lineWidth=1;x.fillStyle=HUD_COL.ink;x.textAlign='center';
    const hd=((psi*RAD)%360+360)%360;
    for(let d=-60;d<=60;d+=10){const deg=Math.round(hd/10)*10+d;const px=cx+(deg-hd)*2.8;if(Math.abs(px-cx)>165)continue;const big=deg%30===0;x.beginPath();x.moveTo(px,32);x.lineTo(px,big?24:28);x.stroke();
      if(big){const lab=((deg%360)+360)%360;x.fillText(lab===0?'N':lab===90?'E':lab===180?'S':lab===270?'W':String(lab/10),px,15);}}
    x.fillStyle=HUD_COL.amber;x.beginPath();x.moveTo(cx,34);x.lineTo(cx-5,42);x.lineTo(cx+5,42);x.fill();
    x.font='bold 16px "Arial Narrow",sans-serif';x.fillStyle='#000';x.fillRect(cx-22,42,44,20);x.fillStyle=HUD_COL.ink;x.fillText(String(Math.round(hd)).padStart(3,'0'),cx,52);
    if(GUIDE.on)guideDrawTape(x,cx,hd);   // click to fly: the target's bearing, distance, height (92_coach.js)
    // wind: arrow from where it blows, relative to the nose
    const w=S.wind,ws=Math.hypot(w[0],w[1])/KT;if(ws>0.5){const from=Math.atan2(-w[1],-w[0])-psi;x.save();x.translate(cx+200,24);x.rotate(from);x.strokeStyle=HUD_COL.ice;x.lineWidth=2;x.beginPath();x.moveTo(0,-14);x.lineTo(0,10);x.moveTo(-5,4);x.lineTo(0,10);x.lineTo(5,4);x.stroke();x.restore();x.fillStyle=HUD_COL.ice;x.font='12px "Arial Narrow",sans-serif';x.fillText(ws.toFixed(0)+' kt',cx+200,48);}
  }
  /* ---- airspeed / altitude boxes ---- */
  x.font='13px "Arial Narrow",sans-serif';
  const box=(bx,by,label,val,unit,sub)=>{x.fillStyle=HUD_COL.panel;x.fillRect(bx,by,110,64);x.textAlign='left';x.fillStyle=HUD_COL.mute;x.fillText(label,bx+8,by+12);x.font='bold 30px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ink;x.fillText(val,bx+8,by+36);x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText(unit,bx+8+x.measureText(val).width*2.3,by+40);if(sub)x.fillText(sub,bx+8,by+56);x.font='13px "Arial Narrow",sans-serif';};
  const gs=Math.hypot(...mrot(qmat(S.q),S.vb).slice(0,2))/KT;
  const byb=cockpit&&HUD.panelA>0.5?Math.min(Hh/2-90,HUD.panelTop-84):Hh/2-90;   // (2.12) above the panel when the approach view has lifted it
  box(12,byb,'IAS',String(Math.round(S.ias/KT)||0),'kt','GS '+(Math.round(gs)||0)+' kt   TAS '+(Math.round(S.tas/KT)||0));
  const ra=S.hAGL/FT;
  box(W-122,byb,ra<250?'RAD ALT':'ALT',String(Math.round(ra<250?ra:S.alt/FT)||0),'ft',ra<250?'ALT '+(Math.round(S.alt/FT)||0)+' ft':'');
  /* ---- (2.16.3) the vertical speed scale, under the ALT box, as on a glass cockpit's VSI ----
     A scale labelled in fpm (0, 500, 1000, 2000 up and down; 0 to 500 fpm take half of it, so a hover's small
     changes are readable and a descent's are still on it), a white pointer with the value in a box beside it,
     and the 6-s mark: a cyan bug on the scale labelled '6 s' with its value, and an arrow from the pointer to it,
     which says at a glance which way the vertical speed is going and how far (with the controls held). The bar
     of 2.13.2 to 2.16.2 had no numbers, filled green or amber from the middle and was hard to read. Within
     ±20 fpm the pointer reads 0 and is grey; sinking faster than 800 fpm below 100 ft it turns amber. */
  {const ws=110,x0=W-122,room=(cockpit&&HUD.panelA>0.5?HUD.panelTop:Hh)-10-(byb+70),side=room<120;   // above a lifted panel: beside the ALT box, compact
   const hh=side?30:Math.min(84,(room-46)/2),top=side?byb:byb+70,X0=side?x0-ws-6:x0,cy=top+20+hh,sx=X0+44;
   HUD.vsD=HUD.vsD===undefined?S.vs/FPM:HUD.vsD+(S.vs/FPM-HUD.vsD)*Math.min(1,(dt||0.016)/0.25);const vf=HUD.vsD;
   const yv=f=>{const a=Math.min(Math.abs(f),2000),k=a<=500?0.5*a/500:a<=1000?0.5+0.25*(a-500)/500:0.75+0.25*(a-1000)/1000;return cy-Math.sign(f)*k*hh;};
   x.fillStyle=HUD_COL.panel;x.fillRect(X0,top,ws,2*hh+(side?30:46));
   x.font='11px "Arial Narrow",sans-serif';x.textAlign='left';x.textBaseline='alphabetic';x.fillStyle=HUD_COL.mute;x.fillText('V/S  fpm',X0+8,top+13);
   x.strokeStyle='rgba(232,226,214,0.55)';x.lineWidth=1;x.beginPath();x.moveTo(sx+0.5,yv(2000));x.lineTo(sx+0.5,yv(-2000));x.stroke();
   x.textAlign='right';x.textBaseline='middle';
   const labs=side?[0,1000,-1000]:[0,500,1000,2000,-500,-1000,-2000];
   for(const f of [100,200,300,400,1500,-100,-200,-300,-400,-1500]){if(side)break;x.beginPath();x.moveTo(sx-3,yv(f)+0.5);x.lineTo(sx,yv(f)+0.5);x.stroke();}
   for(const f of labs){const y=yv(f);x.beginPath();x.moveTo(sx-6,y+0.5);x.lineTo(sx,y+0.5);x.stroke();x.fillStyle=f===0?HUD_COL.ink:HUD_COL.mute;x.fillText(f===0?'0':(f>0?'+':'−')+Math.abs(f),sx-8,y);}
   // the 6-s mark and the arrow towards it
   const tr=PRED.vsTr;
   if(tr!=null){const ty=yv(tr/FPM),py=yv(vf);x.strokeStyle=HUD_COL.ice;x.fillStyle=HUD_COL.ice;
     if(Math.abs(ty-py)>6){x.lineWidth=2;x.setLineDash([3,2]);x.beginPath();x.moveTo(sx+4,py);x.lineTo(sx+4,ty+(ty>py?-5:5));x.stroke();x.setLineDash([]);
       x.beginPath();x.moveTo(sx+4,ty);x.lineTo(sx,ty+(ty>py?-6:6));x.lineTo(sx+8,ty+(ty>py?-6:6));x.closePath();x.fill();}
     x.beginPath();x.moveTo(sx-1,ty);x.lineTo(sx-7,ty-4);x.lineTo(sx-7,ty+4);x.closePath();x.fill();   // the bug on the scale
     x.font='10px "Arial Narrow",sans-serif';x.textAlign='left';const tv=Math.abs(tr/FPM)<20?0:Math.round(tr/FPM/10)*10;x.fillText(`in 6 s ${tv>0?'+':tv<0?'−':''}${Math.abs(tv)}`,X0+ws-50,Math.min(top+2*hh+24,Math.max(top+24,ty+(Math.abs(ty-py)<14?(ty>py?11:-11):0))));}
   // the pointer and its value
   {const py=yv(vf),lv=Math.abs(vf)<20,warn=vf<-800&&S.hAGL<100*FT,col=lv?HUD_COL.mute:warn?HUD_COL.amber:HUD_COL.ink,v=lv?0:Math.round(vf/10)*10;
    x.fillStyle=col;x.beginPath();x.moveTo(sx+2,py);x.lineTo(sx+10,py-6);x.lineTo(sx+10,py+6);x.closePath();x.fill();
    x.font='bold 13px "Arial Narrow",sans-serif';const t=(v>0?'+':v<0?'−':'')+Math.abs(v),tw=x.measureText(t).width+8;x.fillStyle='rgba(13,12,10,0.9)';x.fillRect(sx+10,py-9,tw,18);x.strokeStyle=col;x.lineWidth=1;x.strokeRect(sx+10.5,py-8.5,tw-1,17);
    x.fillStyle=col;x.textAlign='left';x.fillText(t,sx+14,py+0.5);}
   if(!side){const ly=top+2*hh+36,tri=(tx,c,r)=>{x.fillStyle=c;x.beginPath();x.moveTo(r?tx+7:tx,ly);x.lineTo(r?tx:tx+7,ly-4);x.lineTo(r?tx:tx+7,ly+4);x.closePath();x.fill();};   // the legend
     x.font='10px "Arial Narrow",sans-serif';x.textAlign='left';tri(X0+8,HUD_COL.ink);x.fillStyle=HUD_COL.mute;x.fillText('now',X0+18,ly+0.5);tri(X0+44,HUD_COL.ice,true);x.fillStyle=HUD_COL.mute;x.fillText('in 6 s',X0+54,ly+0.5);}
   x.textBaseline='alphabetic';x.font='13px "Arial Narrow",sans-serif';x.textAlign='left';}
  /* ---- NR and FLI arcs ---- */
  const arc=(cx,cy,r,v0,v1,val,bands,label,fmt)=>{x.lineWidth=7;const a0=-225*DEG,a1=45*DEG,ang=v=>a0+(clamp(v,v0,v1)-v0)/(v1-v0)*(a1-a0);
    for(const [lo,hi,col] of bands){x.strokeStyle=col;x.beginPath();x.arc(cx,cy,r,ang(lo),ang(hi));x.stroke();}
    x.strokeStyle=HUD_COL.ink;x.lineWidth=3;const a=ang(val);x.beginPath();x.moveTo(cx+Math.cos(a)*(r-12),cy+Math.sin(a)*(r-12));x.lineTo(cx+Math.cos(a)*(r+8),cy+Math.sin(a)*(r+8));x.stroke();
    x.textAlign='center';x.fillStyle=HUD_COL.mute;x.fillText(label,cx,cy+r-2);x.font='bold 22px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ink;x.fillText(fmt,cx,cy-2);x.font='13px "Arial Narrow",sans-serif';};
  if(cockpit){if(S.eng.mode==='off'&&S.NR<5&&PANEL.lay){x.fillStyle=HUD_COL.amber;x.textAlign='left';x.fillText('Shift+E  start the engines (by hand: Shift+B rotor brake, Shift+1, Shift+2)',16,HUD.panelTop-14);}   // the panel's VEMD shows rotor speed, FLI and the engines
  }else{x.save();x.scale(sB,sB);const Hh=Hb;const cx=70,cy=Hh-80;x.fillStyle=HUD_COL.panel;x.fillRect(8,Hh-150,260,142);
    const auto=S.eng.mode==='off'||S.eng.fli<1.5;
    const nb=auto?[[80,85,HUD_COL.hot],[85,110,HUD_COL.ok],[110,120,HUD_COL.hot]]:[[80,90,HUD_COL.hot],[90,97,HUD_COL.amber],[97,104,HUD_COL.ok],[104,106,HUD_COL.amber],[106,120,HUD_COL.hot]];
    arc(cx,cy,42,80,120,S.NR,nb,'NR %',S.NR.toFixed(1));
    const fb=S.eng.mode==='oei'?[[0,10,HUD_COL.ok],[10,11.5,HUD_COL.amber],[11.5,12.5,HUD_COL.hot]]:[[0,10,HUD_COL.ok],[10,11,HUD_COL.amber],[11,12.5,HUD_COL.hot]];
    arc(cx+120,cy,42,0,12.5,S.eng.fli,fb,'FLI',S.eng.fli.toFixed(1));
    x.textAlign='left';x.fillStyle=S.eng.mode==='twin'?HUD_COL.mute:HUD_COL.hot;x.fillText(S.eng.mode.toUpperCase()+(S.eng.limit?'  '+S.eng.limit:'')+'   '+((S.Peng||S.Pload)/1e3).toFixed(0)+' / '+(S.Pavail/1e3).toFixed(0)+' kW   '+S.m.toFixed(0)+' kg',16,Hh-16);
    if(S.eng.mode==='off'&&S.NR<5){x.fillStyle=HUD_COL.amber;x.fillText('Shift+E  start the engines (Shift+B brake, Shift+1 / 2)',16,Hh-160);}
    // limit lamps
    const lamps=[['VRS',st.vrs>0.35],['STALL',st.stall>0.2],['FEN',S.fen.stall>0.5],['GE',st.ge<0.95],['Mdd',st.Mtip>rt.Mdd]];
    let ly=Hh-140;for(const [n,on] of lamps){x.fillStyle=on?(n==='GE'?HUD_COL.ice:HUD_COL.hot):'rgba(138,130,116,0.35)';x.fillText(n,236,ly);ly+=17;}
    x.restore();}
  /* ---- rotor-state map (hudDisc) ---- */
  if(cfg.rotorDisc&&!cockpit){x.save();x.scale(sB,sB);hudDisc(x,Wb-92,Hb-92);x.restore();}   // in the cockpit it is a screen of the panel (and gone with it while looking around)
  /* ---- controls and the hover drift vector ---- */
  if(cfg.predict&&PRED.res){x.save();if(cockpit&&HUD.panelA>0.5){x.beginPath();x.rect(0,0,W,HUD.panelTop);x.clip();}predDraw3D(x);x.restore();}   // the predicted path's labels in the view (87_predict.js), above the panel
  {const L=PANEL.lay;
   if(L){x.save();x.scale(L.s,L.s);hudCtl(x,L.ctl.cx,L.ctl.cy);hudNav(x,L.nav.plan.cx,L.nav.plan.cy,L.nav.plan.R,L.nav.prof);if(L.rot)hudDisc(x,L.rot.cx,L.rot.cy);x.restore();}   // in the panel's screens
   else if(!cockpit){x.save();x.scale(sB,sB);const [cx,cy]=hudCtlPos(Wb,Hb),[px,py,pr]=hudPlanPos(Wb,Hb);hudCtl(x,cx,cy);hudNav(x,cfg.predict?px:cx+190,cfg.predict?py:cy,pr,hudProfRect(Wb,Hb));x.restore();}
   afcsDraw(x);}   // the autopilot's modes, targets and lanes (91_assist.js)
  /* ---- attitude numbers (chase/tower) ---- */
  if(!cockpit){x.textAlign='center';x.fillStyle=HUD_COL.mute;x.fillText(`pitch ${(th*RAD).toFixed(0)}°  roll ${(phi*RAD).toFixed(0)}°`,W/2,70);}
  /* ---- tutor panel and highlights ---- */
  if(TUTOR.on){
    const L=LESSONS[TUTOR.li],st=L.steps[TUTOR.si];
    const rects=hudRects(W,Hh);
    const pulse=0.55+0.45*Math.sin(S.t*4);x.strokeStyle=`rgba(255,179,0,${pulse})`;x.lineWidth=2.5;
    for(const id of (st.hl||[])){const r=rects[id];if(r)x.strokeRect(r[0],r[1],r[2],r[3]);}
    const bw=Math.min(W-40,640),bx=W/2-bw/2;x.font='15px "Arial Narrow",sans-serif';
    const lines=wrapText(x,st.text,bw-28);const bh=lines.length*20+64,by=hudSlotT(bh+(TUTOR.passed>0||TUTOR.lessonDone?34:0));
    x.fillStyle='rgba(13,12,10,0.86)';x.fillRect(bx,by,bw,bh);x.strokeStyle=HUD_COL.amber;x.lineWidth=1;x.strokeRect(bx,by,bw,bh);
    x.textAlign='left';x.fillStyle=HUD_COL.amber;x.font='bold 13px "Arial Narrow",sans-serif';
    x.fillText(`Lesson ${TUTOR.li+1}/${LESSONS.length} · ${L.title}   ·   Step ${TUTOR.si+1}/${L.steps.length}`,bx+14,by+16);
    x.fillStyle=HUD_COL.ink;x.font='15px "Arial Narrow",sans-serif';lines.forEach((l,i)=>x.fillText(l,bx+14,by+40+i*20));
    if(TUTOR.prog>0&&TUTOR.passed<=0){x.fillStyle='#2a2620';x.fillRect(bx+14,by+bh-18,bw-28,6);x.fillStyle=HUD_COL.ice;x.fillRect(bx+14,by+bh-18,(bw-28)*TUTOR.prog,6);}
    x.fillStyle=HUD_COL.mute;x.font='11px "Arial Narrow",sans-serif';x.textAlign='right';x.fillText(st.manual?'N next · B back · Shift+Q quits the tutor':'B back · N skips · Shift+Q quits the tutor',bx+bw-12,by+bh-8);
    if(TUTOR.passed>0||TUTOR.lessonDone){x.textAlign='center';x.font='bold 22px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ok;
      x.fillText(TUTOR.lessonDone?'Lesson complete – N for the next one':'✓ Good',W/2,by+bh+26);}
  }
  /* ---- (2.13.3) at the start, for 12 s after the welcome card: where the keys are explained ---- */
  {const wel=typeof document!=='undefined'&&document.getElementById('welcome'),open=wel&&wel.style.display!=='none',now=performance.now()/1000;
   if(!open&&HUD.keysT0===undefined)HUD.keysT0=now;if(UI.showKeys)HUD.keysSeen=true;
   const kt=HUD.keysT0===undefined?-1:now-HUD.keysT0;
   if(kt>=0&&kt<12&&!HUD.keysSeen&&!REPLAY.on){const t='all keys and shortcuts',a=Math.min(1,kt/0.4)*Math.min(1,(12-kt)/1.2),pl=0.55+0.45*Math.abs(Math.sin(kt*3));
    x.save();x.globalAlpha=a;x.font='bold 14px "Arial Narrow",sans-serif';const tw=x.measureText(t).width,w=tw+112,bx=W/2-w/2,by=hudSlotT(30);
    x.fillStyle='rgba(13,12,10,0.85)';x.fillRect(bx,by,w,30);x.strokeStyle=`rgba(255,179,0,${pl})`;x.lineWidth=2;x.strokeRect(bx+1,by+1,w-2,28);
    x.textBaseline='middle';x.textAlign='center';for(const [kx,kw,kl] of [[bx+8,22,'?'],[bx+52,26,'F1']]){x.fillStyle=HUD_COL.amber;x.fillRect(kx,by+6,kw,18);x.fillStyle='#0d0c0a';x.fillText(kl,kx+kw/2,by+15.5);}
    x.fillStyle=HUD_COL.mute;x.font='12px "Arial Narrow",sans-serif';x.fillText('or',bx+41,by+15.5);x.font='bold 14px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ink;x.textAlign='left';x.fillText(t,bx+90,by+15.5);x.restore();}}
  /* ---- incident banner ---- */
  if(S.incident&&S.incident.t!==HUD.incT){HUD.incT=S.incident.t;HUD.incText=S.incident.text;HUD.incId=S.incident.id;HUD.incShow=S.t;}
  if(HUD.incText&&S.t-HUD.incShow<10){x.textAlign='center';x.font='14px "Arial Narrow",sans-serif';const lines=wrapText(x,HUD.incText,Math.min(W-80,760));
    const bh=lines.length*18+16,by0=hudSlotT(bh);x.fillStyle=HUD.incId==='crash'?'rgba(255,59,31,0.85)':'rgba(255,179,0,0.85)';x.fillRect(W/2-Math.min(W-80,760)/2-10,by0,Math.min(W-80,760)+20,bh);x.fillStyle='#0d0c0a';
    lines.forEach((l,i)=>x.fillText(l,W/2,by0+16+i*18));}
  replayDraw(x,W,Hh);coachDraw(x,W,Hh);
  /* (2.13.3) the middle: paused, crash and debrief one under the other around the centre (the debrief lay on the crash box) */
  const dbf=UI.debrief&&S.t-UI.debrief.t<14&&!TUTOR.on?UI.debrief:null,psd=UI.paused&&!REPLAY.on&&!(typeof CAL!=='undefined'&&CAL.on);
  let ym;{const hs=[psd?44:0,S.crash?54:0,dbf?dbf.rows.length*20+46:0].filter(Boolean),tot=hs.reduce((a,b)=>a+b,0)+Math.max(0,hs.length-1)*10;ym=Math.max(HUD.slotT,Hh/2-30-tot/2);}
  if(typeof CAL!=='undefined'&&CAL.on){   // (2.14) fitting the stick to the mouse pad (80_input.js)
    const w=Math.min(W-40,540),bx=W/2-w/2,sw=CAL.max-CAL.min,ft=clamp(Math.round(sw*0.45/50)*50,300,2500);x.font='13px "Arial Narrow",sans-serif';
    const L1=wrapText(x,'Move the mouse at the pace you fly, from the left edge of the pad to the right edge, without lifting it. Full stick will lie just inside the edges.',w-32);
    x.font='12px "Arial Narrow",sans-serif';const L2=wrapText(x,DEV.mouse.raw?'Raw movement: the pointer acceleration is bypassed.':'With the system\'s pointer acceleration a quick move and a slow one differ; switch it off: '+mouseAccelPath()+'.',w-32);
    const h=64+L1.length*18+L2.length*16+44,by=Math.max(HUD.slotT,ym);ym=by+h+10;
    x.fillStyle='rgba(13,12,10,0.92)';x.fillRect(bx,by,w,h);x.strokeStyle=HUD_COL.amber;x.lineWidth=1;x.strokeRect(bx+0.5,by+0.5,w-1,h-1);
    x.textAlign='left';x.fillStyle=HUD_COL.amber;x.font='bold 15px "Arial Narrow",sans-serif';x.fillText('Fit the stick to your mouse pad',bx+16,by+24);
    x.fillStyle=HUD_COL.ink;x.font='13px "Arial Narrow",sans-serif';L1.forEach((l,i)=>x.fillText(l,bx+16,by+46+i*18));let y=by+46+L1.length*18;
    const bw=w-32,k=Math.min(1,sw/3000);x.fillStyle='#2a2620';x.fillRect(bx+16,y,bw,8);x.fillStyle=sw>=300?HUD_COL.ok:HUD_COL.amber;x.fillRect(bx+16,y,bw*k,8);
    x.fillStyle=HUD_COL.mute;x.font='12px "Arial Narrow",sans-serif';x.fillText(sw>=300?`sweep ${Math.round(sw)} px → full stick ${ft} px`:`sweep ${Math.round(sw)} px (at least 300)`,bx+16,y+24);y+=40;
    L2.forEach((l,i)=>x.fillText(l,bx+16,y+i*16));y+=L2.length*16+6;x.fillStyle=HUD_COL.amber;x.fillText('Click to take it · Enter skips · the setup has it again (Input models)',bx+16,y+4);}
  if(psd){x.textAlign='center';x.font='bold 24px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.amber;x.fillText('PAUSED',W/2,ym+22);x.font='13px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText('Space or click into the view',W/2,ym+42);ym+=54;}   // (the key is Space; P is the predictor)
  if(S.crash){x.textAlign='center';x.fillStyle='rgba(255,59,31,0.9)';x.fillRect(W/2-190,ym,380,54);x.fillStyle='#0d0c0a';x.font='bold 20px "Arial Narrow",sans-serif';x.fillText(S.crash,W/2,ym+20);x.font='13px "Arial Narrow",sans-serif';x.fillText('R = restart at the same place · L = replay of the last 20 s',W/2,ym+42);ym+=64;}
  if(dbf){const d=dbf,bw=300,bh=d.rows.length*20+46,bx=W/2-bw/2,by=ym;
    x.fillStyle='rgba(13,12,10,0.88)';x.fillRect(bx,by,bw,bh);x.strokeStyle=HUD_COL.ice;x.lineWidth=1;x.strokeRect(bx,by,bw,bh);
    x.textAlign='left';x.fillStyle=HUD_COL.ice;x.font='bold 14px "Arial Narrow",sans-serif';x.fillText(d.title,bx+14,by+18);x.font='13px "Arial Narrow",sans-serif';
    d.rows.forEach(([k,v],i)=>{x.fillStyle=HUD_COL.mute;x.textAlign='left';x.fillText(k,bx+14,by+42+i*20);x.fillStyle=HUD_COL.ink;x.textAlign='right';x.fillText(v,bx+bw-14,by+42+i*20);});}
  if(UI.showKeys){const K=[['Mouse','a click into the view captures it as the stick; buttons left/right = pedals; the system\'s pointer acceleration off keeps it steady'],['C · middle button','hold and look around (the mouse turns the head)'],['Q E (hold)','glance out of the left / right door window at the ground beside the skid; the mouse keeps flying'],['Shift+Z · Z','head tracking by webcam on / off · centre it'],['Esc','release the mouse'],['Wheel · W S','collective'],['A D','pedals'],['Arrows','stick'],['T','trim to the present attitude'],['Shift + arrows','beep trim'],['Y','back to the hover trim'],['Shift+E','engines: the start sequence (brake off, ENG 1, ENG 2, FLIGHT); running: IDLE, then OFF'],['Shift+1 · Shift+2','one engine\'s main switch a step: OFF – IDLE – FLIGHT and back'],['Shift+B','rotor brake (engines off, below 50 % NR)'],['H','hover assist'],['V','autopilot demonstration'],['U I O','autopilot modes: U ALT (height), I HOV (hover position) or IAS (speed), O HDG (heading); moving a control it drives gives it back'],['M (hold)','click to fly: point at a spot on the ground or in the plan view, wheel for a point in the air, click; the gold arrows lead you there · right-click clears'],['K','coach: off / cues / cues + voice'],['1 2 3','cockpit · chase · tower'],['4','the approach view on / off: the gaze lowers 15° (chin windows in the setup; a hint offers it on the approach)'],['F','flight path marker'],['P','predicted path on / off'],['Space','pause'],['R','repeat reset'],['G','engine failure'],['L','replay of the last 20 s'],['X','CSV export'],['N B Shift+Q','tutor next · back · quit'],['? · F1','this list']];
    const bw=420,bh=K.length*18+40,bx=W/2-bw/2,by=Hh/2-bh/2-30;x.fillStyle='rgba(13,12,10,0.9)';x.fillRect(bx,by,bw,bh);x.strokeStyle=HUD_COL.amber;x.strokeRect(bx,by,bw,bh);
    x.font='13px "Arial Narrow",sans-serif';K.forEach(([k,v],i)=>{x.textAlign='right';x.fillStyle=HUD_COL.amber;x.fillText(k,bx+110,by+26+i*18);x.textAlign='left';x.fillStyle=HUD_COL.ink;x.fillText(v,bx+124,by+26+i*18);});}
  guideDraw(x);aimDraw(x);   // click to fly (92_coach.js): the far target, the cursor
  /* ---- the hints' line (2.13.3: stacked from the panel upwards, lowest first: sound, head tracking, the mouse,
     looking around / the demonstration, the approach view, the coach's legend; they used to sit at fixed heights
     and lie on one another) ---- */
  if(typeof SND!=='undefined'&&!SND.on&&cfg.sound&&!(document.getElementById('welcome')&&document.getElementById('welcome').style.display!=='none')){const y=hudSlotB(14);x.textAlign='center';x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText('Click into the view to enable sound',W/2,y+11);}
  if(cockpit&&HT.on&&!HT.ok&&HT.cal&&!REPLAY.on){const y=hudSlotB(14);x.font='12px "Arial Narrow",sans-serif';x.textAlign='center';x.fillStyle=HUD_COL.amber;x.fillText('head tracking: no face in the picture',W/2,y+11);}   // (2.13)
  if(cfg.mouse&&!REPLAY.on&&!DEV.mouse.armed&&DEV.mouse.on&&!UI.paused){const y=hudSlotB(16);x.textAlign='center';x.font='13px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.amber;x.fillText('Click into the view to capture the mouse as the stick – Esc releases it',W/2,y+12);}
  /* (2.13.3) the first capture of the mouse: the pointer acceleration. With it a quick move out and a slow one back
     do not meet, and the stick creeps; where Chrome passes the raw movement (Windows, macOS, ChromeOS) it says so */
  if(cfg.mouse&&DEV.mouse.firstArm!==undefined&&!REPLAY.on){const mt=performance.now()/1000-DEV.mouse.firstArm,T=DEV.mouse.raw?6:14;
   if(mt>=0&&mt<T){const a=Math.min(1,mt/0.4)*Math.min(1,(T-mt)/1.2),l1=DEV.mouse.raw?'Mouse stick: raw movement, the pointer acceleration is bypassed':'Mouse stick: switch the pointer acceleration off for a steady stick',l2=DEV.mouse.raw?'':mouseAccelPath();
    x.save();x.globalAlpha=a;x.font='bold 13px "Arial Narrow",sans-serif';const w1=x.measureText(l1).width;x.font='12px "Arial Narrow",sans-serif';const w=Math.max(w1,l2?x.measureText(l2).width:0)+28,h=l2?40:24,y=hudSlotB(h);
    x.fillStyle='rgba(13,12,10,0.82)';x.fillRect(W/2-w/2,y,w,h);x.strokeStyle=DEV.mouse.raw?HUD_COL.ok:HUD_COL.amber;x.lineWidth=1;x.strokeRect(W/2-w/2+0.5,y+0.5,w-1,h-1);
    x.textAlign='center';x.font='bold 13px "Arial Narrow",sans-serif';x.fillStyle=DEV.mouse.raw?HUD_COL.ok:HUD_COL.amber;x.fillText(l1,W/2,y+16);if(l2){x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ink;x.fillText(l2,W/2,y+33);}x.restore();}}
  if(DEV.look.on){const y=hudSlotB(16);x.textAlign='center';x.font='12px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.mute;x.fillText('Looking around – release returns the view forward, the stick stays where it was',W/2,y+12);}
  if(UI.apDemo&&!REPLAY.on){const y=hudSlotB(18);x.textAlign='center';x.font='bold 15px "Arial Narrow",sans-serif';x.fillStyle=HUD_COL.ice;x.fillText('AUTOPILOT FLYING – V hands the controls back',W/2,y+14);}
  if(cockpit&&APR.hint&&APR.hintT<8&&!REPLAY.on){   // (2.12.4) the approach view's hint, above the panel
    const a=Math.min(1,APR.hintT/0.3)*Math.min(1,(8-APR.hintT)/1),t=APR.hint==='apr'?(cfg.aprChin?'Approach view: look down through the chin windows':'Approach view: the gaze lower, towards the landing spot'):'Back to the normal view for the take-off';
    x.save();x.globalAlpha=a;x.font='bold 13px "Arial Narrow",sans-serif';const tw=x.measureText(t).width+44,bx=W/2-tw/2,by=hudSlotB(24);
    x.fillStyle='rgba(13,12,10,0.82)';x.fillRect(bx,by,tw,24);x.strokeStyle=HUD_COL.amber;x.lineWidth=1;x.strokeRect(bx+0.5,by+0.5,tw-1,23);
    x.fillStyle=HUD_COL.amber;x.fillRect(bx+6,by+4,18,16);x.fillStyle='#0d0c0a';x.textAlign='center';x.textBaseline='middle';x.fillText('4',bx+15,by+12.5);
    x.fillStyle=HUD_COL.ink;x.textAlign='left';x.fillText(t,bx+32,by+12.5);x.restore();}
  coachLegend(x,W);   // (92_coach.js) the top of the hints' stack
  // mouse stick: a small cross shows the virtual stick around the centre of the view
  if(cfg.mouse&&!REPLAY.on){
    if(DEV.mouse.armed){const cx0=W/2,cy0=Hh/2-40;const sx=cx0+DEV.mouse.vx*110,sy=cy0+DEV.mouse.vy*110;
      x.strokeStyle='rgba(232,226,214,0.25)';x.lineWidth=1;x.strokeRect(cx0-110,cy0-110,220,220);
      if(SAS.mode==='att'&&SAS.rc){x.fillStyle='rgba(232,226,214,0.7)';x.beginPath();x.arc(cx0,cy0,2.2,0,7);x.fill();x.font='11px "Arial Narrow",sans-serif';x.textAlign='right';x.fillStyle='rgba(232,226,214,0.45)';x.fillText('rate command · centre holds',cx0+106,cy0+104);}   // (2.13.1) the dead centre of the rate command
      x.strokeStyle='rgba(255,179,0,0.85)';x.lineWidth=1.5;x.beginPath();x.arc(sx,sy,7,0,7);x.moveTo(sx-12,sy);x.lineTo(sx-4,sy);x.moveTo(sx+4,sy);x.lineTo(sx+12,sy);x.moveTo(sx,sy-12);x.lineTo(sx,sy-4);x.moveTo(sx,sy+4);x.lineTo(sx,sy+12);x.stroke();}
  }
}
/* (2.13.3) The boards never lie on one another: at the top centre they stack downwards from under the
   heading tape (tutor, the keys' hint at the start, incident, coach, click to fly), on the hints' line
   upwards from the panel (hudDraw's order), in the middle around the centre (paused, crash, debrief).
   Each returns the top of the room it takes. */
function hudSlotT(h){const y=HUD.slotT;HUD.slotT+=h+8;return y;}
function hudSlotB(h){HUD.slotB-=h;const y=HUD.slotB;HUD.slotB-=6;return y;}
/* where the pointer acceleration is switched off, for this system */
function mouseAccelPath(){const p=String((typeof navigator!=='undefined'&&((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||navigator.userAgent))||'');
  if(/Win/i.test(p))return 'Windows: Settings › Mouse › Additional mouse settings › Pointer Options › Enhance pointer precision off';
  if(/Mac/i.test(p))return 'macOS: System Settings › Mouse › Advanced › Pointer acceleration off';
  if(/CrOS|Chrome OS/i.test(p))return 'ChromeOS: Settings › Device › Mouse › Enable mouse acceleration off';
  if(/Linux|X11/i.test(p))return 'GNOME: Settings › Mouse & Touchpad › Mouse Acceleration off · KDE: Mouse › Pointer acceleration: None';
  return 'in the system\'s mouse settings: pointer acceleration off';}
function wrapText(x,text,maxW){const words=text.split(' ');const lines=[];let cur='';for(const w of words){const t=cur?cur+' '+w:w;if(x.measureText(t).width>maxW){lines.push(cur);cur=w;}else cur=t;}if(cur)lines.push(cur);return lines;}
