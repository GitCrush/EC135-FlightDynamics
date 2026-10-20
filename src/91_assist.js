/* ═══════════════ AUTOPILOT (AFCS) ON THE VIEW: its modes, its targets, its hands ═══════════════
   The modes are those of an automatic flight control system (70_pilot.js,
   AFCS): ALT and V/S on the collective, HDG on the pedals in the hover and
   on the bank at speed, HOV (hover position) and IAS on the cyclic. Keys:
   U ALT, I HOV below 40 kt / IAS above, O HDG; J opens the menu with V/S
   and the targets.

   It is there to be watched. Every mode has a colour, and the same colour
   marks three things on the view:
     its target          on the instrument it belongs to (the height
                         scale, the heading tape, the speed scale, the
                         hover spot on the ground and in the plan view);
     the deviation       it works against, drawn from the present value to
                         the target on that instrument;
     its hand            on the control indicator: the control's position,
                         where it moved in the last two seconds (a fading
                         trail) and where it is moving now (an arrow).
   While a mode is correcting (its control is off the trim it has settled
   to by more than a threshold), its target and its control light up
   together, so the cause and the correction are seen at the same moment.
   The motion predictor (87_predict.js) runs the engaged modes too: its path
   shows where the corrections take the aircraft.

   The pilot can always take a control: moving one that a mode drives
   (stick, lever, pedals, wheel, keys, gamepad) releases the modes on it,
   bumplessly, and the strip says so. (2.1-2.3 had the autopilot take
   single controls, with text explaining its corrections: it was hard to
   follow what it did, when and why.) */
const AFC_COL={alt:'#46d2ff',vs:'#46d2ff',hdg:'#ff6ad5',hov:'#8cf06e',ias:'#8cf06e'};
const AFC_NAME={alt:'ALT',vs:'V/S',hdg:'HDG',hov:'HOV',ias:'IAS'};
const AFCS_UI={msg:'',note:null,trail:[],base:null,act:{},ovAcc:{lon:0,lat:0}};
function afcsBlocked(){return TUTOR.on?'The tutor lesson flies the controls it needs. Stop the lesson (Q) to use the autopilot.':
  UI.apDemo?'The V demonstration flies everything; V hands it back.':REPLAY.on?'Replay is running.':S.crash?'Reset first.':'';}
function afcsUnavailable(m){const f=S.ias>40*KT;if(m==='ias'&&!f)return 'IAS holds an airspeed above 40 kt.';
  if(m==='hov'){if(f)return 'HOV holds a hover position below 40 kt.';const vN=mrot(qmat(S.q),S.vb);if(Math.hypot(vN[0],vN[1])>20*KT)return 'HOV: slow down below 20 kt over the ground first.';}return '';}
const NONE_HELD=()=>({col:false,lon:false,lat:false,ped:false});
/* which axes are not in the pilot's hands right now: the tutor's locks, the V demonstration, the autopilot's modes (the coach leaves those alone) */
function axisHeld(k){if(UI.apDemo)return true;if(TUTOR.on)return k==='col'?TUTOR.lockCol:k==='ped'?TUTOR.lockPed:k==='lon'?TUTOR.lockLon:TUTOR.lockLat;return !!AFCS.held[k];}
/* channels the modes no longer drive go back to the pilot without a bump */
function afcsReleased(before){const now=afcsAny()?afcsChannels():NONE_HELD();
  for(const k of ['col','lon','lat','ped'])if(before[k]&&!now[k]){afcsHandback(k);if(k==='col')DEV.kbd.col=IN.col;if(k==='ped')DEV.kbd.psiRef=S.eul[2];}
  if(!before.lon&&now.lon){DEV.mouse.vy=0;AFCS_UI.ovAcc.lon=0;}if(!before.lat&&now.lat){DEV.mouse.vx=0;AFCS_UI.ovAcc.lat=0;}   // taken over: the mouse stick centred there (see afcsStep)
  AFCS.held=now;if(!afcsAny()){AP.on=false;AP.posN=AP.posE=null;AP.kci=undefined;AFCS_UI.trail=[];}}
function afcsNote(text,col){AFCS_UI.note={text,col:col||'#ffb300',t:S.t};}
/* the pilot (a key, a button, the menu) switches a mode */
function afcsToggle(m,on){
  const bl=afcsBlocked();if(bl){afcsNote(bl);AFCS_UI.msg=bl;return false;}
  if(on===undefined)on=!AFCS[m];
  if(on){const u=afcsUnavailable(m);if(u){afcsNote(u);AFCS_UI.msg=u;return false;}}
  const before=afcsAny()?afcsChannels():NONE_HELD(),was=afcsAny();
  if(!was&&on){AFCS_UI.base=null;AFCS_UI.trail=[];}
  const ok=afcsSet(m,on);
  if(ok){afcsReleased(before);AFCS_UI.msg='';afcsNote(`${AFC_NAME[m]} ${on?'on':'off'}`,on?AFC_COL[m]:'#8a8274');}
  if(typeof afcsButtons==='function')afcsButtons();
  return ok;}
function afcsOffAll(){if(!afcsAny())return;const before=afcsChannels();afcsOff();afcsReleased(before);if(typeof afcsButtons==='function')afcsButtons();}
/* the pilot moves a control that modes drive: those modes let go (called from inputStep before the SAS) */
function afcsPilotTakes(ch){if(!AFCS.held[ch])return;const before=afcsChannels(),off=afcsModesOn(ch).filter(m=>AFCS[m]);
  for(const m of off)AFCS[m]=false;afcsReleased(before);
  const what={col:'the collective',lon:'the cyclic',lat:'the cyclic',ped:'the pedals'}[ch];
  afcsNote(`${off.map(m=>AFC_NAME[m]).join(' + ')} off: you have ${what}`);if(typeof afcsButtons==='function')afcsButtons();}
/* Nudge a target: height 10 ft in the hover and 100 ft at speed, vertical speed 100 fpm, heading 10°,
   airspeed 5 kt (45-140), the hover spot 5 m ahead, back, left or right. False when that mode is off. */
function afcsAdjust(k,d){
  if(afcsBlocked())return false;const f=AFCS.fast;
  if(k==='alt'&&AFCS.alt){const g=S.alt-S.hAGL,st=f?100:10,fl=f?200:5,cur=(AFCS.tAlt-g)/FT;let n=(Math.round(cur/st)+d)*st;if(d<0&&n<fl){if(cur<=fl+0.5)return false;n=fl;}AFCS.tAlt=g+n*FT;return true;}
  if(k==='vs'&&AFCS.vs){AFCS.tVs=clamp((Math.round(AFCS.tVs/FPM/100)+d)*100,-2000,1500)*FPM;return true;}
  if(k==='hdg'&&AFCS.hdg){AFCS.tHdg=wrapPi((Math.round(AFCS.tHdg*RAD/10)+d)*10*DEG);return true;}
  if(k==='ias'&&AFCS.ias){AFCS.tIas=clamp((Math.round(AFCS.tIas/5)+d)*5,45,140);return true;}
  if(k==='hov'&&AFCS.hov){const a=S.eul[2]+({f:0,b:Math.PI,r:Math.PI/2,l:-Math.PI/2})[d];AFCS.spotN+=5*Math.cos(a);AFCS.spotE+=5*Math.sin(a);return true;}
  return false;}
/* what each engaged mode holds, as text (menu, strip) */
function afcsTargetText(m){const f=AFCS.fast;
  if(m==='alt'){const st=f?10:1;return Math.round((AFCS.tAlt-(S.alt-S.hAGL))/FT/st)*st+' ft';}
  if(m==='vs'){const v=Math.round(AFCS.tVs/FPM);return (v>0?'+':'')+v+' fpm';}
  if(m==='hdg')return hdgText(AFCS.tHdg);if(m==='ias')return Math.round(AFCS.tIas)+' kt';
  if(m==='hov'){const d=Math.hypot(AFCS.spotN-S.pos[0],AFCS.spotE-S.pos[1]);if(AFCS.go)return 'flying to the spot, '+(d<100?d.toFixed(0):Math.round(d/10)*10)+' m';return d<0.5?'over the spot':d.toFixed(1)+' m to the spot';}return '';}
const hdgText=a=>String(Math.round(((a*RAD)%360+360)%360)%360).padStart(3,'0')+'°';
/* Called every frame after the devices and the SAS have written IN, before the physics. */
function afcsStep(dt){
  if(afcsAny()&&afcsBlocked())afcsOffAll();
  if(!afcsAny()){AFCS_UI.base=null;return;}
  const before={...AFCS.held};
  afcsApply(dt);
  /* a stick axis just taken over: the mouse stick is centred there now and its movement counted from zero.
     Until 2.6 the deflection it had when the mode engaged counted as the pilot moving it, and with the mouse
     as the stick (never quite centred) HOV, IAS or click to fly let go again at once. */
  if(!before.lon&&AFCS.held.lon){DEV.mouse.vy=0;AFCS_UI.ovAcc.lon=0;}if(!before.lat&&AFCS.held.lat){DEV.mouse.vx=0;AFCS_UI.ovAcc.lat=0;}
  for(const k of ['col','lon','lat','ped'])if(before[k]&&!AFCS.held[k]){afcsHandback(k);if(k==='col')DEV.kbd.col=IN.col;if(k==='ped')DEV.kbd.psiRef=S.eul[2];}
  if(!afcsAny()){AP.on=false;afcsNote('mode out of its speed range: off');if(typeof afcsButtons==='function')afcsButtons();return;}
  if(AFCS.held.col)DEV.kbd.col=IN.col;if(AFCS.held.ped)DEV.kbd.psiRef=AFCS.tHdg;
  afcsTrack(dt);}
/* the hands: trim each control has settled to (4 s average), the trail of the last 2 s, the rate now,
   and which channel is correcting (above the threshold, letting go below 60 % of it) */
function afcsTrack(dt){
  const c={col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped};
  if(!AFCS_UI.base)AFCS_UI.base={...c};const b=AFCS_UI.base,k=Math.min(1,dt/4);for(const a in c)b[a]+=(c[a]-b[a])*k;
  const tr=AFCS_UI.trail;tr.push({t:S.t,...c});while(tr.length&&S.t-tr[0].t>2)tr.shift();
  const thr={col:0.012,lon:AFCS.fast?0.015:0.012,lat:AFCS.fast?0.015:0.012,ped:0.02};
  for(const a in c){const m=Math.abs(c[a]-b[a])/thr[a];const on=AFCS_UI.act[a]?m>0.6:m>1;AFCS_UI.act[a]=on&&AFCS.held[a];}}
/* the mode that drives a channel now (for its colour) */
function afcsModeOf(ch){if(!AFCS.held[ch])return null;return afcsModesOn(ch).find(m=>AFCS[m])||null;}
function afcsRate(ch){const tr=AFCS_UI.trail;if(tr.length<2)return 0;const a=tr[tr.length-1];let i=tr.length-1;while(i>0&&a.t-tr[i].t<0.3)i--;const o=tr[i];return a.t>o.t?(a[ch]-o[ch])/(a.t-o.t):0;}
/* ---- drawing (from hudDraw): x the HUD context, (cx, cy) the centre of the stick box ---- */
function afcsDraw(x){
  if(TUTOR.on||UI.apDemo)return;
  const W=R3.w,Hh=R3.h,pulse=0.55+0.45*Math.sin(S.t*7),any=afcsAny();
  x.save();x.textBaseline='middle';
  /* the mode strip, top left under the Autopilot tab: what exists, what is on, and the last change */
  {const f=S.ias>40*KT,modes=['alt','vs','hdg',f?'ias':'hov'];let px=8;const py=44;
   x.font='bold 12px "Arial Narrow",sans-serif';
   for(const m of modes){const on=!!AFCS[m],label=AFC_NAME[m]+(on?' '+afcsTargetText(m):''),w=Math.ceil(x.measureText(label).width)+16;
     x.fillStyle=on?'rgba(13,12,10,0.85)':'rgba(13,12,10,0.70)';x.fillRect(px,py,w,22);x.strokeStyle=on?AFC_COL[m]:'rgba(160,152,138,0.7)';x.lineWidth=on?2:1;x.strokeRect(px+0.5,py+0.5,w-1,21);
     x.fillStyle=on?AFC_COL[m]:'rgba(200,192,178,0.9)';x.textAlign='left';x.fillText(label,px+8,py+11.5);px+=w+4;}
   if(!any){x.font='12px "Arial Narrow",sans-serif';const hint='U ALT · I '+(f?'IAS':'HOV')+' · O HDG · J menu',hw=x.measureText(hint).width;x.fillStyle='rgba(13,12,10,0.70)';x.fillRect(px,py,hw+12,22);x.fillStyle='rgba(200,192,178,0.95)';x.fillText(hint,px+6,py+11.5);}
   const n=AFCS_UI.note;if(n&&S.t-n.t<4&&S.t>=n.t){x.globalAlpha=Math.min(1,(4-(S.t-n.t))/1);x.font='bold 13px "Arial Narrow",sans-serif';const w=x.measureText(n.text).width;x.fillStyle='rgba(13,12,10,0.75)';x.fillRect(8,py+26,w+16,20);x.fillStyle=n.col;x.textAlign='left';x.fillText(n.text,16,py+36);x.globalAlpha=1;}}
  if(!any){x.restore();return;}
  const glow=(m,ch)=>AFCS_UI.act[ch]&&AFCS[m];
  /* targets and deviations, each on its instrument */
  // HDG: bug on the heading tape, the arc from the nose to it
  if(AFCS.hdg){const col=AFC_COL.hdg,tx=W/2,psi=S.eul[2],d=wrapPi(AFCS.tHdg-psi)*RAD,bx=tx+clamp(d,-58,58)*2.8,act=glow('hdg',AFCS.fast?'lat':'ped')||glow('hdg','ped');
    x.strokeStyle=col;x.fillStyle=col;x.lineWidth=act?4:2.5;x.globalAlpha=act?pulse:0.9;
    x.beginPath();x.moveTo(tx,38);x.lineTo(bx,38);x.stroke();x.globalAlpha=1;
    x.beginPath();x.moveTo(bx-7,26);x.lineTo(bx+7,26);x.lineTo(bx+7,40);x.lineTo(bx,34);x.lineTo(bx-7,40);x.closePath();x.lineWidth=2;x.stroke();
    if(Math.abs(d)>58){x.font='bold 12px "Arial Narrow",sans-serif';x.textAlign='center';x.fillText((d>0?'▶ ':'◀ ')+hdgText(AFCS.tHdg),bx,72);}}
  // V/S: its target on the vertical speed bar
  if(AFCS.vs){const col=AFC_COL.vs,vb=W-16,cyv=Hh/2+20,v=clamp(AFCS.tVs/FPM/2000,-1,1),yv=cyv-v*78,act=glow('vs','col');x.strokeStyle=col;x.lineWidth=act?4:2.5;x.globalAlpha=act?pulse:1;
    x.beginPath();x.moveTo(vb-12,yv);x.lineTo(vb+8,yv);x.stroke();x.globalAlpha=1;x.fillStyle=col;x.font='bold 11px "Arial Narrow",sans-serif';x.textAlign='right';x.fillText('V/S',vb-14,yv);}
  afcsDrawLanes(x);
  // HOV: the spot on the ground in the view, and the line from below the aircraft to it
  if(AFCS.hov){const col=AFC_COL.hov,g=-terrainH(AFCS.spotN,AFCS.spotE),act=glow('hov','lon')||glow('hov','lat');
    const ring=[];for(let i=0;i<=24;i++){const a=i/24*2*Math.PI;ring.push(project([AFCS.spotN+2*Math.cos(a),AFCS.spotE+2*Math.sin(a),g-0.05]));}
    x.strokeStyle=col;x.lineWidth=act?4:2.5;x.globalAlpha=act?pulse:0.95;x.beginPath();let pen=false;for(const p of ring){if(!p){pen=false;continue;}if(!pen){x.moveTo(p[0],p[1]);pen=true;}else x.lineTo(p[0],p[1]);}x.stroke();
    for(const [a,b] of [[[-3,0],[3,0]],[[0,-3],[0,3]]]){const p=project([AFCS.spotN+a[0],AFCS.spotE+a[1],g-0.05]),q=project([AFCS.spotN+b[0],AFCS.spotE+b[1],g-0.05]);if(p&&q){x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(q[0],q[1]);x.stroke();}}
    const gu=-terrainH(S.pos[0],S.pos[1]),u=project([S.pos[0],S.pos[1],gu-0.05]),s=project([AFCS.spotN,AFCS.spotE,g-0.05]);
    if(u&&s){x.setLineDash([6,5]);x.lineWidth=2;x.beginPath();x.moveTo(u[0],u[1]);x.lineTo(s[0],s[1]);x.stroke();x.setLineDash([]);}x.globalAlpha=1;}
  x.restore();}
/* the hands on the control indicator (stick box centred at cx, cy): position, the trail of the last 2 s, the motion now, in the colour of the mode that moves it */
function afcsDrawHands(x,cx,cy){
  if(TUTOR.on||UI.apDemo||!afcsAny())return;
  const pulse=0.55+0.45*Math.sin(S.t*7);x.save();x.textBaseline='middle';
  const tr=AFCS_UI.trail,trail=(fx,fy)=>{if(tr.length<2)return;for(let i=1;i<tr.length;i++){const a=tr[i-1],b=tr[i];x.globalAlpha=0.15+0.65*i/tr.length;x.beginPath();x.moveTo(fx(a),fy(a));x.lineTo(fx(b),fy(b));x.stroke();}x.globalAlpha=1;};
  const arrow=(x0,y0,dx,dy)=>{const L=Math.hypot(dx,dy);if(L<3)return;const a=Math.atan2(dy,dx),x1=x0+dx,y1=y0+dy;x.beginPath();x.moveTo(x0,y0);x.lineTo(x1,y1);x.stroke();
    x.beginPath();x.moveTo(x1+5*Math.cos(a),y1+5*Math.sin(a));x.lineTo(x1-6*Math.cos(a-0.55),y1-6*Math.sin(a-0.55));x.lineTo(x1-6*Math.cos(a+0.55),y1-6*Math.sin(a+0.55));x.closePath();x.fill();};
  const tag=(m,tx,ty,align)=>{x.font='bold 11px "Arial Narrow",sans-serif';x.textAlign=align||'center';x.fillStyle=AFC_COL[m];x.fillText(AFC_NAME[m],tx,ty);};
  const mLon=afcsModeOf('lon'),mLat=afcsModeOf('lat'),mCol=afcsModeOf('col'),mPed=afcsModeOf('ped');
  if(mLon||mLat){   // stick box: 28 px per unit of stick
    const sx=a=>cx+a.lat*28,sy=a=>cy-a.lon*28,same=mLon&&mLat&&mLon===mLat;x.lineWidth=2;x.strokeStyle=AFC_COL[mLon||mLat];trail(sx,sy);
    const p={lat:IN.lat,lon:IN.lon},rl=afcsRate('lat')*0.6*28,rn=-afcsRate('lon')*0.6*28;
    if(mLat){x.strokeStyle=x.fillStyle=AFC_COL[mLat];if(AFCS_UI.act.lat){x.globalAlpha=pulse;x.lineWidth=2;x.strokeRect(cx-32,cy-32,64,64);x.globalAlpha=1;}x.lineWidth=2.5;arrow(sx(p),sy(p),clamp(rl*6,-40,40),0);}
    if(mLon){x.strokeStyle=x.fillStyle=AFC_COL[mLon];if(AFCS_UI.act.lon){x.globalAlpha=pulse;x.lineWidth=2;x.strokeRect(cx-35,cy-35,70,70);x.globalAlpha=1;}x.lineWidth=2.5;arrow(sx(p),sy(p),0,clamp(rn*6,-40,40));}
    x.fillStyle=AFC_COL[mLon||mLat];x.beginPath();x.arc(sx(p),sy(p),5,0,7);x.fill();
    if(same)tag(mLon,cx,cy-38);else{if(mLon)tag(mLon,cx-34,cy-38,'left');if(mLat)tag(mLat,cx+34,cy-38,'right');}}
  if(mCol){const y=a=>cy+30-a.col*60;x.strokeStyle=x.fillStyle=AFC_COL[mCol];x.lineWidth=3;trail(()=>cx+45,y);
    if(AFCS_UI.act.col){x.globalAlpha=pulse;x.lineWidth=2;x.strokeRect(cx+37,cy-33,16,66);x.globalAlpha=1;}
    x.fillRect(cx+38,y(IN)-2,14,4);x.lineWidth=2.5;arrow(cx+58,y(IN),0,clamp(-afcsRate('col')*0.6*60*6,-36,36));tag(mCol,cx+45,cy-38);}
  if(mPed){const px=a=>cx+100+a.ped*40;x.strokeStyle=x.fillStyle=AFC_COL[mPed];x.lineWidth=3;trail(px,()=>cy+26);
    if(AFCS_UI.act.ped){x.globalAlpha=pulse;x.lineWidth=2;x.strokeRect(cx+58,cy+18,84,16);x.globalAlpha=1;}
    x.fillRect(px(IN)-2,cy+18,4,16);x.lineWidth=2.5;arrow(px(IN),cy+40,clamp(afcsRate('ped')*0.6*40*6,-40,40),0);tag(mPed,cx+148,cy+26,'left');}
  x.restore();
}
/* The lanes: one row per engaged mode, read left to right as cause and correction. Left the deviation
   it works against (the target is the coloured centre line, the aircraft the white mark, the gap filled
   in the mode's colour, where the predictor puts the aircraft in 5 s as a hollow mark); right the
   correction, on the control it moves (the centre line is the trim it has settled to, the white mark
   the control now, its trail of the last 2 s, the offset filled in colour). While it corrects, the lane
   lights up. Vertical gauges for height, speed, collective and stick fore/aft (up = up, faster, raise,
   forward), horizontal ones for heading, pedals and stick left/right, a square for the hover spot and
   the stick. */
function afcsDrawLanes(x){
  const lanes=[],f=AFCS.fast,b=AFCS_UI.base||{col:IN.col,lon:IN.lon,lat:IN.lat,ped:IN.ped},tr=AFCS_UI.trail;
  const p5=typeof predAt==='function'?predAt(5):null,psi=S.eul[2];
  if(AFCS.alt){const span=f?200:20;lanes.push({m:'alt',dev:{k:'v',v:(S.alt-AFCS.tAlt)/FT/span,g:p5?(-p5.d-AFCS.tAlt)/FT/span:null,txt:fmtS((S.alt-AFCS.tAlt)/FT)+' ft',sc:'±'+span+' ft'},ctl:[{ch:'col',k:'v',span:0.1,name:'collective'}]});}
  if(AFCS.vs)lanes.push({m:'vs',dev:{k:'v',v:(S.vs-AFCS.tVs)/FPM/500,g:null,txt:fmtS((S.vs-AFCS.tVs)/FPM)+' fpm',sc:'±500 fpm'},ctl:[{ch:'col',k:'v',span:0.1,name:'collective'}]});
  if(AFCS.hdg){const d=wrapPi(psi-AFCS.tHdg)*RAD;lanes.push({m:'hdg',dev:{k:'h',v:d/20,g:p5?wrapPi(p5.psi-AFCS.tHdg)*RAD/20:null,txt:fmtS(d)+'°',sc:'±20°'},ctl:f?[{ch:'lat',k:'h',span:0.1,name:'stick L/R'},{ch:'ped',k:'h',span:0.1,name:'pedals'}]:[{ch:'ped',k:'h',span:0.2,name:'pedals'}]});}
  if(AFCS.ias){const d=S.ias/KT-AFCS.tIas;lanes.push({m:'ias',dev:{k:'v',v:d/20,g:null,txt:fmtS(d)+' kt',sc:'±20 kt'},ctl:[{ch:'lon',k:'v',span:0.1,name:'stick fore/aft'}]});}
  if(AFCS.hov){const c=Math.cos(psi),s=Math.sin(psi),dn=S.pos[0]-AFCS.spotN,de=S.pos[1]-AFCS.spotE,al=dn*c+de*s,ac=-dn*s+de*c,dist=Math.hypot(al,ac),sc=[5,20,100,500,2000].find(v=>v>=dist*1.1)||2000;
    let g=null;if(p5){const gn=p5.n-AFCS.spotN,ge=p5.e-AFCS.spotE;g=[(gn*c+ge*s)/sc,(-gn*s+ge*c)/sc];}
    lanes.push({m:'hov',dev:{k:'2',v:[al/sc,ac/sc],g,txt:dist.toFixed(1)+' m',sc:'±'+sc+' m'},ctl:[{ch:'stick',k:'2',span:0.1,name:'stick'}]});}
  if(!lanes.length)return;
  const W=R3.w,Hh=R3.h,LH=74,x0=8,y0=Math.max(118,Hh/2-16),pw=250,pulse=0.55+0.45*Math.sin(S.t*7);
  if(y0+lanes.length*LH>Hh-160&&Hh<560)return;   // no room in a very small window
  x.save();x.textBaseline='middle';
  lanes.forEach((L,i)=>{const y=y0+i*LH,col=AFC_COL[L.m],act=L.ctl.some(c=>c.ch==='stick'?(AFCS_UI.act.lon||AFCS_UI.act.lat):AFCS_UI.act[c.ch]);
    x.fillStyle='rgba(13,12,10,0.66)';x.fillRect(x0,y,pw,LH-6);x.strokeStyle=col;x.lineWidth=act?2.5:1;x.globalAlpha=act?pulse:0.6;x.strokeRect(x0+0.5,y+0.5,pw-1,LH-7);x.globalAlpha=1;
    x.fillStyle=col;x.font='bold 13px "Arial Narrow",sans-serif';x.textAlign='left';x.fillText(AFC_NAME[L.m],x0+6,y+11);
    x.fillStyle='rgba(232,226,214,0.75)';x.font='10px "Arial Narrow",sans-serif';x.fillText('off target',x0+6,y+25);x.fillText(L.dev.sc,x0+6,y+37);
    // the deviation gauge
    afcsGauge(x,L.dev.k,x0+52,y+6,52,48,L.dev.v,L.dev.g,null,col);
    x.fillStyle='#e8e2d6';x.font='bold 11px "Arial Narrow",sans-serif';x.textAlign='center';x.fillText(L.dev.txt,x0+78,y+61);
    // cause → correction
    x.strokeStyle=x.fillStyle=col;x.lineWidth=act?3:1.5;x.globalAlpha=act?pulse:0.5;x.beginPath();x.moveTo(x0+110,y+30);x.lineTo(x0+124,y+30);x.stroke();x.beginPath();x.moveTo(x0+129,y+30);x.lineTo(x0+122,y+25);x.lineTo(x0+122,y+35);x.fill();x.globalAlpha=1;
    // the correction gauges
    const n=L.ctl.length,gw=n>1?52:60;
    L.ctl.forEach((c,j)=>{const gx=x0+134+j*(gw+6),key=c.ch==='stick'?null:c.ch;
      const val=c.ch==='stick'?[(IN.lon-b.lon)/c.span,(IN.lat-b.lat)/c.span]:(IN[key]-b[key])/c.span;
      const trail=tr.map(q=>c.ch==='stick'?[(q.lon-b.lon)/c.span,(q.lat-b.lat)/c.span]:(q[key]-b[key])/c.span);
      afcsGauge(x,c.k,gx,y+6,gw,48,val,null,trail,col);
      x.fillStyle='rgba(232,226,214,0.75)';x.font='10px "Arial Narrow",sans-serif';x.textAlign='center';x.fillText(c.name,gx+gw/2,y+61);});
  });
  x.restore();}
function fmtS(v){const a=Math.abs(v),r=a<10?a.toFixed(1):a.toFixed(0);return (v>0.05?'+':v<-0.05?'−':'')+r;}
/* a gauge: k 'v' vertical, 'h' horizontal, '2' a square (v = [up, right]); v the value over the span
   (clamped at the edge), g a hollow mark (predicted), trail the last positions; centre line in colour */
function afcsGauge(x,k,gx,gy,w,h,v,g,trail,col){
  x.fillStyle='rgba(0,0,0,0.55)';x.fillRect(gx,gy,w,h);const cx=gx+w/2,cy=gy+h/2;
  const P=val=>k==='v'?[cx,cy-clamp(val,-1,1)*(h/2-3)]:k==='h'?[cx+clamp(val,-1,1)*(w/2-3),cy]:[cx+clamp(val[1],-1,1)*(w/2-3),cy-clamp(val[0],-1,1)*(h/2-3)];
  x.strokeStyle=col;x.lineWidth=2;x.beginPath();if(k==='v'){x.moveTo(gx,cy);x.lineTo(gx+w,cy);}else if(k==='h'){x.moveTo(cx,gy);x.lineTo(cx,gy+h);}else{x.moveTo(gx,cy);x.lineTo(gx+w,cy);x.moveTo(cx,gy);x.lineTo(cx,gy+h);}x.stroke();
  if(trail&&trail.length>1){x.strokeStyle=col;x.lineWidth=2;for(let i=1;i<trail.length;i++){const a=P(trail[i-1]),c=P(trail[i]);x.globalAlpha=0.12+0.5*i/trail.length;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(c[0],c[1]);x.stroke();}x.globalAlpha=1;}
  const p=P(v);x.strokeStyle=col;x.lineWidth=6;x.globalAlpha=0.85;x.beginPath();x.moveTo(cx,cy);if(k==='v')x.lineTo(cx,p[1]);else if(k==='h')x.lineTo(p[0],cy);else x.lineTo(p[0],p[1]);x.stroke();x.globalAlpha=1;
  if(g!==null&&g!==undefined){const q=P(g);x.strokeStyle='#e8e2d6';x.lineWidth=1.5;x.beginPath();x.arc(q[0],q[1],4,0,7);x.stroke();}
  x.fillStyle='#ffffff';if(k==='v')x.fillRect(gx+4,p[1]-1.5,w-8,3);else if(k==='h')x.fillRect(p[0]-1.5,gy+4,3,h-8);else{x.beginPath();x.arc(p[0],p[1],4,0,7);x.fill();}}

/* ═══ Click to fly (2.6) ═══
   Hold M: a cursor appears (with the mouse captured as the stick it is moved by the mouse while the stick
   stays where it is; otherwise it is the mouse pointer). Under it the spot on the ground (along the line
   of sight) or in the plan view, with its distance. A click there: HOV flies to it and hovers (70_pilot.js
   afcsGoStep), ALT holds the height above the ground there, HDG turns the nose into the way when the spot
   is more than 25 m off. What the autopilot does with each control shows as always: its lanes at the left,
   its hand on the control indicator, the predicted path. Moving a control takes it back. Releasing M
   without a click changes nothing. */
const AIM={on:false,x:0,y:0,locked:false};
function aimStart(){if(AIM.on)return;AIM.on=true;AIM.locked=!!DEV.mouse.armed;if(AIM.locked||!AIM.x){AIM.x=R3.w/2;AIM.y=R3.h*0.42;}}
function aimStop(){AIM.on=false;}
function aimMove(dx,dy,sx,sy){if(AIM.locked){AIM.x=clamp(AIM.x+dx,0,R3.w);AIM.y=clamp(AIM.y+dy,0,R3.h);}else{AIM.x=sx;AIM.y=sy;}}
/* the spot under a point of the view: in the plan view, or where the line of sight meets the ground */
function aimPick(sx,sy){
  if(cfg.hud&&cfg.predict&&typeof SCOPE!=='undefined'&&SCOPE.cur){const L=PANEL.lay,[cx,cy,R]=L?[L.nav.plan.cx*L.s,L.nav.plan.cy*L.s,L.nav.plan.R*L.s]:cfg.view==='cockpit'?[-1e4,-1e4,0]:hudPlanPos(R3.w,R3.h);
    if(Math.abs(sx-cx)<=R+8&&Math.abs(sy-cy)<=R+8){const k=R/SCOPE.cur.sc,al=-(sy-cy)/k,ac=(sx-cx)/k,c=Math.cos(S.eul[2]),s=Math.sin(S.eul[2]);return {n:S.pos[0]+al*c-ac*s,e:S.pos[1]+al*s+ac*c,src:'plan'};}}
  if(cfg.view==='cockpit'&&HUD.panelA>0.5&&sy>HUD.panelTop)return null;   // the instrument panel
  const c=R3.cam;if(!c.f)return null;const r=vnorm(vcross(c.f,c.u)),uu=vcross(r,c.f),ty=Math.tan(c.fov/2),tx=ty*R3.w/R3.h,xn=sx/R3.w*2-1,yn=1-sy/R3.h*2;
  const d=vnorm(vadd(c.f,vadd(vscl(r,xn*tx),vscl(uu,yn*ty)))),under=t=>{const p=vadd(c.pos,vscl(d,t));return p[2]>=-terrainH(p[0],p[1]);};
  let t0=0.3,t=0.3;if(under(t0))return null;
  while(t<3000){t=Math.max(t*1.03,t+0.4);if(under(t))break;t0=t;}if(t>=3000)return null;
  for(let i=0;i<24;i++){const m=(t0+t)/2;if(under(m))t=m;else t0=m;}
  const p=vadd(c.pos,vscl(d,t));return {n:p[0],e:p[1],src:'view'};}
function aimClick(){const p=aimPick(AIM.x,AIM.y);if(!p){afcsNote('Click to fly: point at the ground or into the plan view');return false;}return afcsFlyTo(p.n,p.e);}
/* why click to fly would refuse this spot now ('' when it would go) */
function afcsFlyCheck(n,e){if(afcsBlocked())return 'stop the tutor lesson first (Q)';if(S.ias>40*KT)return 'slow down below 40 kt first';if(S.onGround)return 'lift into the hover first';
  if(Math.hypot(n-S.pos[0],e-S.pos[1])>2000)return 'at most 2 km away';const vN=mrot(qmat(S.q),S.vb);if(!AFCS.hov&&Math.hypot(vN[0],vN[1])>20*KT)return 'slow below 20 kt over the ground first';return '';}
function afcsFlyTo(n,e){
  const why=afcsFlyCheck(n,e);if(why){afcsNote('Click to fly: '+why);return false;}
  const d=Math.hypot(n-S.pos[0],e-S.pos[1]);
  const before=afcsAny()?afcsChannels():NONE_HELD();if(!afcsAny()){AFCS_UI.base=null;AFCS_UI.trail=[];}
  if(!AFCS.hov&&!afcsSet('hov',true)){afcsNote('Click to fly: too fast over the ground (more than 20 kt)');return false;}
  AFCS.spotN=n;AFCS.spotE=e;AFCS.go={n,e};
  const hold=terrainH(n,e)+1.3+Math.max(2,S.hAGL);   // the height above the ground there as it is here now (at least 2 m)
  if(!AFCS.alt&&!AFCS.vs){afcsSet('alt',true);AFCS.tAlt=hold;}else if(AFCS.alt)AFCS.tAlt=Math.max(AFCS.tAlt,terrainH(n,e)+1.3+2);
  if(!AFCS.hdg)afcsSet('hdg',true);AFCS.tHdg=d>25?Math.atan2(e-S.pos[1],n-S.pos[0]):S.eul[2];
  afcsReleased(before);if(typeof afcsButtons==='function')afcsButtons();
  afcsNote(`Click to fly: ${Math.round(d)} m. It flies there and hovers; move a control to take it back`,AFC_COL.hov);return true;}
function aimDraw(x){
  if(!AIM.on)return;const W=R3.w,X=AIM.x,Y=AIM.y,p=aimPick(X,Y),col=AFC_COL.hov;
  x.save();x.textBaseline='middle';
  if(p&&p.src==='view'){let pr=null;const rr=Math.max(3,10*pgPx([p.n,p.e,-terrainH(p.n,p.e)]));x.strokeStyle=col;x.lineWidth=2;x.beginPath();   // the spot on the ground: a ring of 3 m (at least ~10 px)
    for(let k=0;k<=32;k++){const a=k/32*2*Math.PI,q=project([p.n+rr*Math.cos(a),p.e+rr*Math.sin(a),-terrainH(p.n,p.e)-0.1]);if(!q){pr=null;continue;}if(pr)x.lineTo(q[0],q[1]);else x.moveTo(q[0],q[1]);pr=q;}x.stroke();}
  x.strokeStyle=p?col:'rgba(232,226,214,0.8)';x.lineWidth=1.5;x.beginPath();x.arc(X,Y,9,0,7);x.moveTo(X-18,Y);x.lineTo(X-5,Y);x.moveTo(X+5,Y);x.lineTo(X+18,Y);x.moveTo(X,Y-18);x.lineTo(X,Y-5);x.moveTo(X,Y+5);x.lineTo(X,Y+18);x.stroke();
  const why=p?afcsFlyCheck(p.n,p.e):'',txt=p?(why?why:`fly here · ${Math.round(Math.hypot(p.n-S.pos[0],p.e-S.pos[1]))} m`):'no ground here';x.font='bold 12px "Arial Narrow",sans-serif';const tw=x.measureText(txt).width;
  x.fillStyle='rgba(13,12,10,0.75)';x.fillRect(X+14,Y+12,tw+12,20);x.fillStyle=p&&!why?col:why?HUD_COL.amber:'rgba(232,226,214,0.8)';x.textAlign='left';x.fillText(txt,X+20,Y+22);
  const hint='CLICK TO FLY · click a spot on the ground or in the plan view · release M to cancel';x.font='13px "Arial Narrow",sans-serif';const hw=x.measureText(hint).width;
  x.fillStyle='rgba(13,12,10,0.75)';x.fillRect(W/2-hw/2-10,70,hw+20,22);x.fillStyle=col;x.textAlign='center';x.fillText(hint,W/2,81);
  x.restore();}
