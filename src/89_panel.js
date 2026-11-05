/* ═══════════════ THE COCKPIT: THE EC135 P2+ INSTRUMENT PANEL (2.6.1) ═══════════════
   The cockpit view has no 3D frame any more (the posts are gone, cfg.panel3d brings the old 3D
   cockpit back); the cockpit is the instrument panel, flat across the bottom of the view, as the pilot
   in the right seat sees it under the glareshield:
   - straight ahead the pilot's flight instruments, the classic T: airspeed, attitude, altitude above,
     radar altitude, HSI and vertical speed below, in black housings with screws, glass and bezel;
   - left of them the CPDS of the centre console: the warning unit (its captions include the trainer's
     limit lamps: VRS, STALL, FEN, GE, Mdd) and the VEMD with FLI, rotor speed and the engine figures;
   - further left the trainer's control-position display, right of the flight instruments the
     navigation display (the predictor's scope and height profile) and the rotor-state display, each a
     screen in a bezel with soft keys.
   Laid out on nominal pixels (1330 wide, 236 high) and scaled down to narrower windows. The panel
   surface, the glareshield, the housings, screws, placards and the dial faces are drawn once into a
   cached canvas whenever the size changes; needles, the attitude ball, the compass card, the captions
   and the screens every frame. While the pilot looks around (C) the panel is not drawn. */
const PANEL={cache:null,key:'',lay:null,card:null,cardKey:''};
const PNL_W=1330,PNL_H=236;
/* where everything sits, in nominal pixels (screen = nominal × s) */
function panelLayout(W,Hh,up){
  const s=Math.min(1,W/PNL_W),Wn=W/s,Hn=Hh/s,t=Hn-PNL_H-(up||0)/s,rot=cfg.rotorDisc!==false;   // up (2.12): lifted this many screen pixels off the bottom (the approach view)
  const parts=[['ctl',224],['g',18],['cpds',176],['g',22],['six',312],['g',22],['nav',330]].concat(rot?[['g',18],['rot',176]]:[]);
  const tot=parts.reduce((a,p)=>a+p[1],0);let x=Wn/2-tot/2;const L={s,Wn,Hn,t,W,Hh};
  for(const [k,w] of parts){if(k!=='g')L[k]={x,w};x+=w;}
  L.ctl.y=t+40;L.ctl.h=140;L.ctl.cx=L.ctl.x+54;L.ctl.cy=L.ctl.y+62;
  L.cpds.wu={x:L.cpds.x,y:t+22,w:176,h:46};L.cpds.vemd={x:L.cpds.x,y:t+74,w:176,h:150};
  L.six.cols=[L.six.x+52,L.six.x+156,L.six.x+260];L.six.rows=[t+72,t+174];L.six.D=96;
  L.nav.y=t+18;L.nav.h=208;L.nav.plan={cx:L.nav.x+12+80,cy:t+112,R:72};L.nav.prof=[L.nav.x+182,t+32,136,160];
  if(rot){L.rot.y=t+18;L.rot.h=208;L.rot.cx=L.rot.x+88;L.rot.cy=t+112;}
  return L;}
/* the screen rectangle of a nominal one */
function panelScr(L,x,y,w,h){return [x*L.s,y*L.s,w*L.s,h*L.s];}
function panelVisible(){if(cfg.view!=='cockpit'||cfg.panel3d)return 0;const lk=DEV.look;if(lk.on)return 0;
  if(HT.on&&HT.ok&&!LOOK_GLANCE.on)return 1-sm(0.35,0.7,Math.abs(lk.yaw||0)+Math.max(0,lk.pitch||0)*0.8);   // (2.13) with the head tracked the panel stays for small turns and when looking down (it is down there), and goes when the head turns away
  return 1-sm(0.02,0.15,Math.abs(lk.yaw||0)+Math.abs(lk.pitch||0));}
/* ---- small drawing helpers (nominal coordinates) ---- */
function pnlRR(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.lineTo(X+w-r,Y);x.quadraticCurveTo(X+w,Y,X+w,Y+r);x.lineTo(X+w,Y+h-r);x.quadraticCurveTo(X+w,Y+h,X+w-r,Y+h);x.lineTo(X+r,Y+h);x.quadraticCurveTo(X,Y+h,X,Y+h-r);x.lineTo(X,Y+r);x.quadraticCurveTo(X,Y,X+r,Y);x.closePath();}
function pnlScrew(x,X,Y,r){const g=x.createRadialGradient(X-r*0.3,Y-r*0.3,0,X,Y,r);g.addColorStop(0,'#8d9096');g.addColorStop(1,'#3a3c41');x.fillStyle=g;x.beginPath();x.arc(X,Y,r,0,7);x.fill();
  x.strokeStyle='rgba(0,0,0,0.6)';x.lineWidth=0.8;x.beginPath();x.moveTo(X-r*0.7,Y+r*0.2);x.lineTo(X+r*0.7,Y-r*0.2);x.stroke();}
function pnlLabel(x,text,X,Y,size,col,align){x.font=`bold ${size||8}px Arial,sans-serif`;x.fillStyle=col||'#b9bcc2';x.textAlign=align||'center';x.textBaseline='middle';x.fillText(text,X,Y);}
/* an instrument housing: a black square with rounded corners and four screws, a bezel ring, the face */
function pnlHousing(x,cx,cy,D){const h=D/2;pnlRR(x,cx-h,cy-h,D,D,7);const g=x.createLinearGradient(0,cy-h,0,cy+h);g.addColorStop(0,'#1d1f23');g.addColorStop(1,'#0e0f11');x.fillStyle=g;x.fill();
  x.strokeStyle='rgba(255,255,255,0.08)';x.lineWidth=1;x.stroke();
  for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]])pnlScrew(x,cx+sx*(h-7),cy+sy*(h-7),2.6);
  const r=h-6,bg=x.createLinearGradient(cx-r,cy-r,cx+r,cy+r);bg.addColorStop(0,'#5a5d63');bg.addColorStop(0.5,'#202226');bg.addColorStop(1,'#4a4d52');x.fillStyle=bg;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();
  x.fillStyle='#0a0b0d';x.beginPath();x.arc(cx,cy,r-3.5,0,7);x.fill();}
function pnlTicks(x,cx,cy,r0,r1,a,w,col){x.strokeStyle=col||'#e9e9e6';x.lineWidth=w||1.2;x.beginPath();x.moveTo(cx+r0*Math.cos(a),cy+r0*Math.sin(a));x.lineTo(cx+r1*Math.cos(a),cy+r1*Math.sin(a));x.stroke();}
function pnlNeedle(x,cx,cy,a,L,w,col,tail){x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle=col||'#f2f2ee';x.beginPath();x.moveTo(-(tail||8),-w*0.6);x.lineTo(L-6,-w/2);x.lineTo(L,0);x.lineTo(L-6,w/2);x.lineTo(-(tail||8),w*0.6);x.closePath();x.fill();x.restore();
  x.fillStyle='#2b2d31';x.beginPath();x.arc(cx,cy,3.2,0,7);x.fill();x.fillStyle='#777b82';x.beginPath();x.arc(cx,cy,1.4,0,7);x.fill();}
function pnlGlass(x,cx,cy,r){const g=x.createLinearGradient(cx-r,cy-r,cx+r*0.2,cy+r*0.2);g.addColorStop(0,'rgba(255,255,255,0.10)');g.addColorStop(0.5,'rgba(255,255,255,0.02)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();}
/* scales: angle of a value on each dial (canvas angles, 0 = 3 o'clock, clockwise) */
const PNL_ASI=v=>-Math.PI/2+clamp(v,0,170)/170*Math.PI*1.75;                  // 0 at 12 o'clock, 170 kt after 315°
const PNL_VSI=v=>Math.PI+clamp(v,-2000,2000)/2000*Math.PI*0.9;                 // 0 at 9 o'clock, climb up
const PNL_RA=h=>{const f=h<=500?h/500*0.62:0.62+Math.min(1,(h-500)/2000)*0.3;return -Math.PI/2+f*Math.PI*2;};   // 0-500 ft over 223°, to 2500 over 108° more
/* the static panel: surface, glareshield, housings, bezels, faces, placards; cached per size */
function panelStatic(L,k){
  const key=[L.W,L.Hh,k,L.s,cfg.rotorDisc!==false].join('|');if(PANEL.key===key&&PANEL.cache)return PANEL.cache;
  const cv=PANEL.cache||document.createElement('canvas'),top=L.t-14,h=PNL_H+16;cv.width=Math.ceil(L.W*k);cv.height=Math.ceil(h*L.s*k);
  const x=cv.getContext('2d');x.setTransform(k*L.s,0,0,k*L.s,0,-top*k*L.s);x.clearRect(0,top,L.Wn,h);
  const t=L.t,Wn=L.Wn;
  // the panel surface under the glareshield: dark grey, light from above, a fine grain
  const edge=()=>{x.beginPath();x.moveTo(-2,t+8);x.quadraticCurveTo(Wn/2,t-8,Wn+2,t+8);};
  const bot=t+PNL_H+2;edge();x.lineTo(Wn+2,bot);x.lineTo(-2,bot);x.closePath();
  const g=x.createLinearGradient(0,t,0,bot);g.addColorStop(0,'#3a3c41');g.addColorStop(0.12,'#2f3135');g.addColorStop(1,'#222327');x.fillStyle=g;x.fill();
  {x.save();edge();x.lineTo(Wn+2,bot);x.lineTo(-2,bot);x.closePath();x.clip();let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
   for(let i=0;i<Wn*PNL_H/90;i++){const px=rnd()*Wn,py=t+rnd()*PNL_H,a=rnd();x.fillStyle=a<0.5?`rgba(255,255,255,${(a*0.05).toFixed(3)})`:`rgba(0,0,0,${((a-0.5)*0.12).toFixed(3)})`;x.fillRect(px,py,1.2,1.2);}x.restore();}
  // the glareshield: a padded coaming with a rounded lip, its stitching, and its shade on the panel
  {const lip=x.createLinearGradient(0,t-9,0,t+16);lip.addColorStop(0,'#505358');lip.addColorStop(0.18,'#2a2c30');lip.addColorStop(0.6,'#16171a');lip.addColorStop(1,'rgba(22,23,26,0)');
   x.save();edge();x.lineTo(Wn+2,t+26);x.lineTo(-2,t+26);x.closePath();x.clip();x.fillStyle=lip;x.fillRect(0,t-10,Wn,36);
   x.strokeStyle='rgba(255,255,255,0.07)';x.setLineDash([3,3]);x.lineWidth=0.8;x.beginPath();x.moveTo(-2,t+14);x.quadraticCurveTo(Wn/2,-2+t,Wn+2,t+14);x.stroke();x.setLineDash([]);x.restore();
   edge();x.strokeStyle='rgba(255,255,255,0.22)';x.lineWidth=1.4;x.stroke();}
  // plates behind the groups, with seams and screws
  const plate=(X,Y,w,hh,label)=>{pnlRR(x,X-8,Y-8,w+16,hh+16,5);x.fillStyle='rgba(255,255,255,0.03)';x.fill();x.strokeStyle='rgba(0,0,0,0.45)';x.lineWidth=1.2;x.stroke();
    pnlRR(x,X-7,Y-7,w+14,hh+14,4);x.strokeStyle='rgba(255,255,255,0.05)';x.lineWidth=0.8;x.stroke();for(const [sx,sy] of [[X-3,Y-3],[X+w+3,Y-3],[X-3,Y+hh+3],[X+w+3,Y+hh+3]])pnlScrew(x,sx,sy,2.2);
    if(label)pnlLabel(x,label,X+w/2,Y-3,7.5,'#9a9ea6');};
  // a screen in a bezel: dark frame, the glass, soft keys under it, a placard
  const screen=(X,Y,w,hh,label,keys)=>{plate(X,Y,w,hh,null);pnlRR(x,X,Y,w,hh,6);const bz=x.createLinearGradient(0,Y,0,Y+hh);bz.addColorStop(0,'#1c1e22');bz.addColorStop(1,'#0f1012');x.fillStyle=bz;x.fill();x.strokeStyle='rgba(255,255,255,0.10)';x.lineWidth=1;x.stroke();
    x.fillStyle='#030405';pnlRR(x,X+6,Y+6,w-12,hh-(keys?24:12),3);x.fill();
    if(keys){const n=keys.length,kw=(w-20)/n;keys.forEach((kk,i)=>{const kx=X+10+i*kw;pnlRR(x,kx+2,Y+hh-15,kw-4,10,2);x.fillStyle='#3a3d43';x.fill();pnlLabel(x,kk,kx+kw/2,Y+hh-10,6.5,'#c8ccd2');});}
    if(label)pnlLabel(x,label,X+w/2,Y-12,7.5,'#9a9ea6');};
  screen(L.ctl.x,L.ctl.y,L.ctl.w,L.ctl.h,'CONTROLS · TRAINER',['STICK','COLL','PED','SKID']);
  // CPDS: warning unit and VEMD
  plate(L.cpds.x,L.cpds.wu.y,L.cpds.w,L.cpds.vemd.y+L.cpds.vemd.h-L.cpds.wu.y,null);
  {const wu=L.cpds.wu;pnlRR(x,wu.x,wu.y,wu.w,wu.h,3);x.fillStyle='#121315';x.fill();x.strokeStyle='rgba(255,255,255,0.08)';x.stroke();
   const v=L.cpds.vemd;pnlRR(x,v.x,v.y,v.w,v.h,5);x.fillStyle='#16181b';x.fill();x.strokeStyle='rgba(255,255,255,0.09)';x.stroke();x.fillStyle='#030405';pnlRR(x,v.x+7,v.y+7,v.w-14,v.h-26,3);x.fill();
   ['SCROLL','RESET','SELECT','+','–','OFF'].forEach((kk,i)=>{const kw=(v.w-14)/6,kx=v.x+7+i*kw;pnlRR(x,kx+1.5,v.y+v.h-16,kw-3,10,2);x.fillStyle='#3a3d43';x.fill();pnlLabel(x,kk,kx+kw/2,v.y+v.h-11,6,'#c8ccd2');});
   pnlLabel(x,'VEMD',v.x+v.w-18,v.y+v.h-26+9,6.5,'#6f747c');pnlLabel(x,'CPDS',L.cpds.x+L.cpds.w/2,wu.y-12,7.5,'#9a9ea6');}
  // the flight instruments
  const six=L.six,D=six.D;plate(six.x,six.rows[0]-D/2,six.w,six.rows[1]-six.rows[0]+D,null);
  const faces=[['asi',0,0],['adi',1,0],['alt',2,0],['ra',0,1],['hsi',1,1],['vsi',2,1]];
  for(const [id,c,r] of faces){const cx=six.cols[c],cy=six.rows[r];pnlHousing(x,cx,cy,D);const R=D/2-10;
    if(id==='asi'){x.lineWidth=5;for(const [a,b,col] of [[20,140,'#2fae4a'],[140,155,'#e3c22c']]){x.strokeStyle=col;x.beginPath();x.arc(cx,cy,R-3,PNL_ASI(a),PNL_ASI(b));x.stroke();}
      pnlTicks(x,cx,cy,R-9,R+1,PNL_ASI(155),2.5,'#e3342a');
      for(let v=0;v<=160;v+=10)pnlTicks(x,cx,cy,v%20?R-6:R-9,R,PNL_ASI(v),v%20?1:1.6);
      for(const v of [40,80,120,160]){const a=PNL_ASI(v);pnlLabel(x,String(v),cx+(R-16)*Math.cos(a),cy+(R-16)*Math.sin(a),9,'#ecece8');}
      pnlLabel(x,'KNOTS',cx,cy+16,6,'#9ea2a8');}
    if(id==='alt'){for(let i=0;i<50;i++){const a=-Math.PI/2+i/50*Math.PI*2;pnlTicks(x,cx,cy,i%5?R-5:R-9,R,a,i%5?0.9:1.6);}
      for(let i=0;i<10;i++){const a=-Math.PI/2+i/10*Math.PI*2;pnlLabel(x,String(i),cx+(R-15)*Math.cos(a),cy+(R-15)*Math.sin(a),9.5,'#ecece8');}
      pnlLabel(x,'ALT',cx,cy-13,6,'#9ea2a8');}
    if(id==='vsi'){for(let v=-2000;v<=2000;v+=250){const a=PNL_VSI(v);pnlTicks(x,cx,cy,v%1000?R-6:R-10,R,a,v%1000?1:1.7);}
      for(const v of [0,1000,2000]){for(const sg of v?[1,-1]:[1]){const a=PNL_VSI(v*sg);pnlLabel(x,String(v/1000),cx+(R-16)*Math.cos(a),cy+(R-16)*Math.sin(a),9.5,'#ecece8');}}
      pnlLabel(x,'UP',cx-10,cy-13,6,'#9ea2a8');pnlLabel(x,'DN',cx-10,cy+13,6,'#9ea2a8');pnlLabel(x,'×1000 FPM',cx+10,cy+21,5.5,'#9ea2a8');}
    if(id==='ra'){for(const v of [0,50,100,150,200,250,300,350,400,450,500,750,1000,1500,2000,2500]){const a=PNL_RA(v);pnlTicks(x,cx,cy,v%100&&v<500?R-5:R-9,R,a,v%100&&v<500?0.9:1.5);}
      for(const v of [0,100,200,300,400,500,1000,2500]){const a=PNL_RA(v);pnlLabel(x,String(v/100),cx+(R-15)*Math.cos(a),cy+(R-15)*Math.sin(a),v>=1000?7.5:9,'#ecece8');}
      pnlLabel(x,'RAD ALT',cx,cy+14,5.5,'#9ea2a8');pnlLabel(x,'×100 FT',cx,cy-13,5.5,'#9ea2a8');}
    if(id==='hsi')pnlLabel(x,'HSI',cx+R-2,cy+R-2,5.5,'#6f747c');
    if(id==='adi')pnlLabel(x,'ATT',cx+R-2,cy+R-2,5.5,'#6f747c');}
  // master warning and caution above the attitude indicator, a clock and two knobs
  {const cx=six.cols[1];for(const [dx,l,col] of [[-20,'WARN','#5a1712'],[20,'CAUT','#5a4612']]){pnlRR(x,cx+dx-17,six.rows[0]-D/2-20,34,13,2);x.fillStyle=col;x.fill();x.strokeStyle='rgba(0,0,0,0.6)';x.stroke();}
   for(const [kx,ky,l] of [[six.cols[2]-D/2+9,six.rows[0]+D/2-9,'BARO'],[six.cols[1]-D/2+9,six.rows[1]+D/2-9,'HDG']]){x.fillStyle='#16171a';x.beginPath();x.arc(kx,ky,7,0,7);x.fill();const kg=x.createRadialGradient(kx-2,ky-2,0,kx,ky,6);kg.addColorStop(0,'#666a70');kg.addColorStop(1,'#26282c');x.fillStyle=kg;x.beginPath();x.arc(kx,ky,5.5,0,7);x.fill();pnlLabel(x,l,kx+15,ky+2,5,'#8a8e95');}}
  screen(L.nav.x,L.nav.y,L.nav.w,L.nav.h,'NAVIGATION · PREDICTED PATH',['MAP','PROF','RNG+','RNG–','PRED']);
  if(L.rot)screen(L.rot.x,L.rot.y,L.rot.w,L.rot.h,'ROTOR STATE',['AoA','STALL','μ λ']);
  PANEL.cache=cv;PANEL.key=key;return cv;}
/* the HSI's compass card, rendered once and turned every frame */
function panelCard(r,k){const key=r+'|'+k;if(PANEL.card&&PANEL.cardKey===key)return PANEL.card;
  const cv=document.createElement('canvas'),n=Math.ceil(2*r*k)+2;cv.width=cv.height=n;const x=cv.getContext('2d');x.setTransform(k,0,0,k,n/2,n/2);
  for(let d=0;d<360;d+=5){const a=d*DEG-Math.PI/2;pnlTicks(x,0,0,d%10?r-4:d%30?r-6:r-8,r,a,d%30?0.8:1.4);}
  for(let d=0;d<360;d+=30){const a=d*DEG;x.save();x.rotate(a);pnlLabel(x,d===0?'N':d===90?'E':d===180?'S':d===270?'W':String(d/10),0,-(r-14),d%90?7:8.5,d%90?'#ecece8':'#ffffff');x.restore();}
  PANEL.card=cv;PANEL.cardKey=key;return cv;}
/* the moving parts of the flight instruments */
function panelSix(x,L,k){
  const six=L.six,D=six.D,R=D/2-10,[phi,th,psi]=S.eul;
  // airspeed
  {const cx=six.cols[0],cy=six.rows[0];pnlNeedle(x,cx,cy,PNL_ASI(Math.max(0,S.ias/KT)),R-4,3.2,'#f2f2ee',7);pnlGlass(x,cx,cy,R+2);}
  // attitude: the ball (sky, ground, pitch ladder) turns with the roll and moves with the pitch, the aircraft and the bank scale are fixed
  {const cx=six.cols[1],cy=six.rows[0],r=R+3,kp=1.7;x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.clip();x.translate(cx,cy);x.rotate(-phi);x.translate(0,th*RAD*kp);
    x.fillStyle='#3f7fc0';x.fillRect(-90,-200,180,200);x.fillStyle='#7d5128';x.fillRect(-90,0,180,200);x.strokeStyle='#fff';x.lineWidth=1.6;x.beginPath();x.moveTo(-90,0);x.lineTo(90,0);x.stroke();
    x.lineWidth=1;x.fillStyle='#fff';for(const d of [-20,-15,-10,-5,5,10,15,20]){const y=-d*kp,l=d%10?7:14;x.beginPath();x.moveTo(-l,y);x.lineTo(l,y);x.stroke();if(!(d%10))pnlLabel(x,String(Math.abs(d)),l+7,y,6,'#fff');}
    x.restore();
    x.strokeStyle='#fff';x.lineWidth=1.2;for(const d of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){const a=-Math.PI/2+d*DEG;pnlTicks(x,cx,cy,r-(d%30?4:7),r,a,d%30?1:1.6,'#fff');}
    {const a=-Math.PI/2-phi;x.fillStyle='#ffffff';x.beginPath();x.moveTo(cx+(r-8)*Math.cos(a),cy+(r-8)*Math.sin(a));x.lineTo(cx+(r-15)*Math.cos(a-0.09),cy+(r-15)*Math.sin(a-0.09));x.lineTo(cx+(r-15)*Math.cos(a+0.09),cy+(r-15)*Math.sin(a+0.09));x.closePath();x.fill();}
    x.strokeStyle='#ffb000';x.lineWidth=3;x.beginPath();x.moveTo(cx-26,cy);x.lineTo(cx-9,cy);x.lineTo(cx-4,cy+5);x.moveTo(cx+26,cy);x.lineTo(cx+9,cy);x.lineTo(cx+4,cy+5);x.stroke();x.fillStyle='#ffb000';x.beginPath();x.arc(cx,cy,2.2,0,7);x.fill();
    x.fillStyle='#ffb000';x.beginPath();x.moveTo(cx,cy-r+2);x.lineTo(cx-4,cy-r+9);x.lineTo(cx+4,cy-r+9);x.closePath();x.fill();
    pnlGlass(x,cx,cy,r);}
  // altitude: the hundreds and the thousands hand
  {const cx=six.cols[2],cy=six.rows[0],a=S.alt/FT,ah=-Math.PI/2+((a%1000+1000)%1000)/1000*Math.PI*2,at=-Math.PI/2+((a%10000+10000)%10000)/10000*Math.PI*2;
    pnlNeedle(x,cx,cy,at,R-16,4.5,'#d8d8d4',5);pnlNeedle(x,cx,cy,ah,R-3,2.8,'#f2f2ee',8);pnlGlass(x,cx,cy,R+2);}
  // radar altitude (off scale above 2500 ft: the needle parks under a flag)
  {const cx=six.cols[0],cy=six.rows[1],h=Math.max(0,S.hAGL/FT);if(h<=2500)pnlNeedle(x,cx,cy,PNL_RA(h),R-4,3,'#f2f2ee',7);else{x.fillStyle='#b02a22';x.fillRect(cx-12,cy-5,24,10);pnlLabel(x,'OFF',cx,cy,6.5,'#fff');}
    pnlGlass(x,cx,cy,R+2);}
  // HSI: the card turns with the heading; the lubber line, the aircraft, the autopilot's heading bug when HDG is on
  {const cx=six.cols[1],cy=six.rows[1],r=R+2,card=panelCard(r,k);x.save();x.translate(cx,cy);x.rotate(-psi);x.drawImage(card,-r-1/k,-r-1/k,card.width/k,card.height/k);
    if(AFCS.hdg){const a=AFCS.tHdg;x.rotate(a);x.fillStyle=AFC_COL.hdg;x.fillRect(-4,-r,8,5);x.rotate(-a);}x.restore();
    x.fillStyle='#ffb000';x.beginPath();x.moveTo(cx,cy-r+1);x.lineTo(cx-4,cy-r-5);x.lineTo(cx+4,cy-r-5);x.closePath();x.fill();
    x.strokeStyle='#ffb000';x.lineWidth=2;x.beginPath();x.moveTo(cx,cy-12);x.lineTo(cx,cy+10);x.moveTo(cx-10,cy-2);x.lineTo(cx+10,cy-2);x.moveTo(cx-5,cy+9);x.lineTo(cx+5,cy+9);x.stroke();
    pnlLabel(x,String(Math.round(((psi*RAD)%360+360)%360)%360).padStart(3,'0'),cx,cy+r-12,7,'#f2f2ee');pnlGlass(x,cx,cy,r);}
  // vertical speed
  {const cx=six.cols[2],cy=six.rows[1];
   if(PRED.vsTr!=null){const a=PNL_VSI(PRED.vsTr/FPM);x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle='#6fd3e0';x.beginPath();x.moveTo(R-7,0);x.lineTo(R+1,-4.5);x.lineTo(R+1,4.5);x.closePath();x.fill();x.restore();}   // (2.13.2) where the needle will be in 6 s, controls held
   pnlNeedle(x,cx,cy,PNL_VSI(S.vs/FPM),R-4,3,'#f2f2ee',7);pnlGlass(x,cx,cy,R+2);}
  // master warning / caution
  {const cx=six.cols[1],y=six.rows[0]-D/2-20,warn=S.eng.e.some(e=>e.fail||!e.on)&&S.rot.Om>5||S.NR<95||S.NR>106,caut=S.eng.fli>10.95||S.fen.stall>0.5||S.rot.vrs>0.5||S.fen.failed;
   for(const [dx,l,on,c] of [[-20,'WARN',warn,'#ff3b1f'],[20,'CAUT',caut,'#ffb300']]){if(on&&Math.sin(S.t*8)>-0.3){pnlRR(x,cx+dx-17,y,34,13,2);x.fillStyle=c;x.fill();}pnlLabel(x,l,cx+dx,y+6.5,7,on?'#120f0c':'#9a7a6a');}}}
/* the CPDS: captions of the warning unit, and the VEMD */
function panelCpds(x,L){
  const st=S.rot,rt=H.rotor,wu=L.cpds.wu,v=L.cpds.vemd;
  const caps=[['ENG',S.eng.e.some(e=>e.fail||!e.on)&&st.Om>5,'#ff3b1f'],['RPM',S.NR<95||S.NR>106,'#ff3b1f'],['FLI',S.eng.fli>10.95,'#ffb300'],['T/R',S.fen.failed||S.fen.stall>0.5,'#ffb300'],['XMSN',S.eng.Qmast>(S.eng.QmaxMast||1e12),'#ffb300'],
    ['VRS',st.vrs>0.35,'#ff3b1f'],['STALL',st.stall>0.2,'#ff3b1f'],['FEN',S.fen.stall>0.5,'#ffb300'],['GE',st.ge<0.95,'#6fd3e0'],['Mdd',st.Mtip>rt.Mdd,'#ffb300']];
  caps.forEach(([t,on,c],i)=>{const cw=(wu.w-12)/5,X=wu.x+6+(i%5)*cw,Y=wu.y+5+Math.floor(i/5)*19;pnlRR(x,X+1,Y,cw-2,16,2);x.fillStyle=on?c:'#24262a';x.fill();pnlLabel(x,t,X+cw/2,Y+8,7.5,on?'#0d0c0a':'#666a72');});
  // VEMD: FLI dial and value on top, rotor and engine figures below
  const X=v.x+7,Y=v.y+7,w=v.w-14,cx=X+46,cy=Y+46,r=32;
  {const v0=0,v1=12.5,a0=Math.PI*0.75,ang=f=>a0+clamp(f,v0,v1)/v1*Math.PI*1.5,bands=S.eng.mode==='oei'?[[0,10,'#3fae49'],[10,11.5,'#e8c02a'],[11.5,12.5,'#d33']]:[[0,10,'#3fae49'],[10,11,'#e8c02a'],[11,12.5,'#d33']];
   x.lineWidth=5;for(const [a,b,c] of bands){x.strokeStyle=c;x.beginPath();x.arc(cx,cy,r,ang(a),ang(b));x.stroke();}
   for(let f=0;f<=12;f++)pnlTicks(x,cx,cy,r-7,r-3,ang(f),f%2?0.8:1.3,'#cfd3d8');
   x.save();x.translate(cx,cy);x.rotate(ang(S.eng.fli));x.fillStyle='#fff';x.fillRect(0,-1.4,r-2,2.8);x.restore();
   pnlLabel(x,S.eng.fli.toFixed(1),cx,cy+12,13,'#ffffff');pnlLabel(x,'FLI',cx,cy-10,7,'#9ea2a8');}
  {const nx=X+w-40,ny=Y+40;pnlLabel(x,'NR',nx,ny-26,7,'#9ea2a8');const nrc=S.NR<97||S.NR>104?(S.NR<95||S.NR>106?'#ff5040':'#e8c02a'):'#7ee07a';pnlLabel(x,S.NR.toFixed(0),nx,ny-12,14,nrc);pnlLabel(x,'%',nx+19,ny-10,7,'#9ea2a8');
   const bx=nx-26,bw=52,f=clamp((S.NR-85)/(110-85),0,1);x.fillStyle='#1a1c20';x.fillRect(bx,ny+2,bw,6);x.fillStyle='#3fae49';x.fillRect(bx+bw*(97-85)/25,ny+2,bw*7/25,6);x.fillStyle='#fff';x.fillRect(bx+bw*f-1,ny,2.5,10);}
  /* (2.16) the engines: main switch (START while the starter runs), N1 and TOT for each, the rotor brake */
  const P=(S.Pbar!==undefined?S.Pbar:S.Peng)/1e3,es=e=>e.fail?'FAIL':!e.on?'OFF':e.startT>0?'START':e.sw==='idle'?'IDLE':'FLT',lines=[['PWR',Math.round(P)+' / '+Math.round(S.Pavail/1e3)+' kW'],['ENG',S.eng.e.map(es).join(' · ')+(S.eng.brake?'  BRAKE':S.eng.limit&&S.eng.limit!=='OFF'?'  '+S.eng.limit:'')],
    ['N1 TOT',S.eng.e.map(e=>Math.round(e.N1)).join('·')+' %  '+S.eng.e.map(e=>Math.round(e.TOT===undefined?0:e.TOT)).join('·')+' °C'],['FUEL',Math.max(0,Math.round(560-S.fuelBurn))+' kg  OAT '+Math.round(atmo(S.alt,cfg.dT).T-273.15)+' °C']];
  lines.forEach(([a,b],i)=>{const ly=Y+82+i*11;x.font='bold 7.5px Arial,sans-serif';x.textAlign='left';x.textBaseline='middle';x.fillStyle='#8fd6e8';x.fillText(a,X+6,ly);x.fillStyle=a==='ENG'&&(S.eng.mode!=='twin'||S.eng.brake||S.eng.e.some(e=>e.sw==='idle'))?'#ffb300':'#e8eef2';x.fillText(b,X+34,ly);});}
/* the whole panel; returns the layout, or null when it is not drawn. The trainer's screens are drawn
   by their own code inside the panel's scale (90_hud.js) */
function panelDraw2D(x,W,Hh,k){
  const a=panelVisible();HUD.panelA=a;if(a<0.02){HUD.panelTop=Hh;HUD.panelUp=0;PANEL.lay=null;return null;}
  const up=panelLift(W,Hh);HUD.panelUp=up;
  const L=panelLayout(W,Hh,up);PANEL.lay=L;HUD.panelTop=(L.t-8)*L.s;
  const cv=panelStatic(L,k);
  x.save();x.globalAlpha=a;
  if(up>0)panelChin(x,L,W,Hh);
  x.drawImage(cv,0,(L.t-14)*L.s,cv.width/k,cv.height/k);
  x.scale(L.s,L.s);panelSix(x,L,k*L.s);panelCpds(x,L);x.restore();
  return L;}
/* ---- the approach view (2.12): the panel lifted to where it hangs, the chin windows under it ----
   The panel's top edge stays at the angle under the nose line where the normal view shows it (about 20°: the
   view's bottom, 36° down, holds the panel at the bottom of the screen), fixed to the airframe. As the gaze
   lowers (APR.k, 85_render.js) that edge climbs the screen; the panel is drawn there, and the band it leaves
   at the bottom shows the floor of the nose with the
   two chin windows, the frame in screen space over the same projection as the view: left of the pedestal the
   copilot's, right of it the pilot's, 2.0-2.75 m ahead of the CG and 0.24-0.80 m out, 0.95 m under the eye,
   which is 36°-60° down. The panel hides their upper part as the real one does. */
function panelLift(W,Hh){const kk=typeof APR==='object'?APR.k:0;if(!(kk>0)||!cfg.aprChin)return 0;const c=R3.cam;if(!c||c.gaze===undefined||DEV.look.on)return 0;   // (2.13) only with the chin windows
  const s=Math.min(1,W/PNL_W),y0=Hh-PNL_H*s,f0=cockpitFov(W/Math.max(1,Hh),0),top=f0.down+Math.atan((y0/Hh*2-1)*Math.tan(f0.v/2));   // the panel's top: its angle under the nose line in the normal view
  const lk=DEV.look,yPhys=Hh/2*(1+Math.tan(top-c.gaze+(lk.pitch||0))/Math.tan(c.fov/2));
  return clamp(y0-yPhys,0,Hh*0.6);}
/* the chin windows' corners on the screen (page pixels); m widens them by m metres */
function chinQuads(m){m=m||0;const R=qmat(S.q),P=(bx,by,bz)=>project(vadd(S.pos,mrot(R,[bx,by,bz])));
  const quads=[];for(const sy of [-1,1]){const q=[P(2.75+m,(0.24-m)*sy,0.60),P(2.75+m,(0.80+m)*sy,0.60),P(2.0-m,(0.80+m)*sy,0.60),P(2.0-m,(0.24-m)*sy,0.60)];if(q.every(v=>v))quads.push(q);}
  return quads;}
function panelChin(x,L,W,Hh){const yb=(L.t+PNL_H)*L.s;if(yb>=Hh-2)return;
  x.save();
  /* (2.12.8) the floor with the two openings as holes in one path (even-odd), no clip and no 'destination-out':
     a canvas on the GPU may fall back to the processor for that compositing mode, and read the whole overlay
     back every frame to do it */
  const quads=chinQuads(0),g=x.createLinearGradient(0,yb,0,Hh);g.addColorStop(0,'#232428');g.addColorStop(1,'#141517');x.fillStyle=g;
  x.beginPath();x.rect(0,yb-1,W,Hh-yb+1);
  const y0=yb-1,clipY=q=>{const o=[];for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length],ia=a[1]>=y0,ib=b[1]>=y0;if(ia)o.push(a);if(ia!==ib){const t=(y0-a[1])/(b[1]-a[1]);o.push([a[0]+(b[0]-a[0])*t,y0]);}}return o;};   // each opening cut at the band's top edge, its sides kept
  for(const q of quads){const c=clipY(q);if(c.length<3)continue;x.moveTo(c[0][0],c[0][1]);for(let i=1;i<c.length;i++)x.lineTo(c[i][0],c[i][1]);x.closePath();}
  x.fill('evenodd');
  x.beginPath();x.rect(0,yb-1,W,Hh-yb+1);x.clip();   // the rims only below the panel
  /* (2.17.2) the glass: a faint green-grey over the window, darker towards its frame (the windows' own picture had it until 2.17.1) */
  for(const q of quads){const cy=(q[0][1]+q[2][1])/2,g2=x.createLinearGradient(0,Math.min(q[0][1],q[1][1]),0,Math.max(q[2][1],q[3][1]));g2.addColorStop(0,'rgba(150,175,185,0.10)');g2.addColorStop(0.5,'rgba(40,60,55,0.05)');g2.addColorStop(1,'rgba(10,14,12,0.16)');
    x.fillStyle=g2;x.beginPath();x.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)x.lineTo(q[i][0],q[i][1]);x.closePath();x.fill();}
  x.lineWidth=2.5;x.strokeStyle='rgba(255,255,255,0.16)';for(const q of quads){x.beginPath();x.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)x.lineTo(q[i][0],q[i][1]);x.closePath();x.stroke();}
  const sh=x.createLinearGradient(0,yb,0,yb+16);sh.addColorStop(0,'rgba(0,0,0,0.55)');sh.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=sh;x.fillRect(0,yb-1,W,18);
  x.restore();}
/* ---- (2.13) the cockpit's frame as the attitude reference ----
   A pilot reads the aircraft's attitude from the horizon against the frame: the windscreen's centre post, the
   door pillars, the roof's bow, the glareshield. The flat panel of 2.6 had kept only the glareshield; this
   draws the rest as thin lines, projected from the airframe through the camera (they bank and pitch with it
   and stay put when the head turns or glances), each as wide as a post of 2-4 cm at its distance. Points from
   the 3D cockpit of 2.0-2.5 (body axes, x forward, y right, z down, metres from the CG). */
const FRAME_LINES=(()=>{const L=[];for(const s of [-1,1]){
    L.push([[2.50,0.78*s,0.40],[2.48,0.80*s,0.02],[2.18,0.84*s,-0.62],[1.66,0.80*s,-1.12]]);   // the pillars along the windscreen
    L.push([[0.72,0.82*s,-1.14],[0.72,0.84*s,0.48]]);                                            // the posts behind the doors
    L.push([[0.72,0.84*s,-1.14],[1.66,0.80*s,-1.12]]);                                           // the roof rails
    L.push([[0.74,0.84*s,0.20],[2.40,0.82*s,0.22]]);}                                            // the doors' windows, lower edge
  L.push([[2.60,0,0.40],[2.56,0,0.07],[2.22,0,-0.68],[1.82,0,-1.16]]);                        // the windscreen's centre post
  L.push([[1.66,-0.80,-1.12],[1.82,0,-1.17],[1.66,0.80,-1.12]]);                              // the roof's bow
  return L;})();
function frameDraw2D(x){if(cfg.view!=='cockpit'||cfg.panel3d||cfg.frame===false)return;const c=R3.cam;if(!c||!c.f)return;
  const R=qmat(S.q),f=R3.h/2/Math.tan(c.fov/2),P=b=>vadd(S.pos,mrot(R,b)),eye=c.pos;
  x.save();x.lineCap='round';x.lineJoin='round';
  for(const line of FRAME_LINES)for(let i=0;i<line.length-1;i++){const a=line[i],b=line[i+1];
    for(let k=0;k<6;k++){const p0=P(a.map((v,j)=>v+(b[j]-v)*k/6)),p1=P(a.map((v,j)=>v+(b[j]-v)*(k+1)/6)),q0=project(p0),q1=project(p1);if(!q0||!q1)continue;
      const d=vlen(vsub(vadd(p0,p1).map(v=>v/2),eye)),w=clamp(0.03*f/Math.max(d,0.3),1,7);
      x.strokeStyle='rgba(26,28,32,0.62)';x.lineWidth=w;x.beginPath();x.moveTo(q0[0],q0[1]);x.lineTo(q1[0],q1[1]);x.stroke();
      if(w>2.5){x.strokeStyle='rgba(255,255,255,0.10)';x.lineWidth=1;x.beginPath();x.moveTo(q0[0]-w*0.25,q0[1]);x.lineTo(q1[0]-w*0.25,q1[1]);x.stroke();}}}
  x.restore();}
