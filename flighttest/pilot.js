/* Scripted test pilot for the simulated flight test.

   Flies every card of flighttest/plan.json in the simulator exactly as the
   plan describes it and writes what happened: time histories and the
   measured values for the card's quantities. It does not judge; the
   expectations (flighttest/cards.json, written blind from sources and
   frozen before the flight, see cards.sha256) are compared by a separate
   evaluator.

   node flighttest/pilot.js            all cards
   node flighttest/pilot.js H2 F4      selected cards

   Output: flighttest/results/<id>.json  {id, title, flown, notes, metrics, series}
   Conventions as in the plan: x forward, y right, z down; roll + right wing
   down, pitch + nose up, yaw + nose right; controls relative to the trim,
   cyclic and pedal as fractions of the travel from centre to stop. */
'use strict';
const fs=require('fs'),path=require('path');
const {loadEngine}=require('../test/load.js');
const OUT=path.join(__dirname,'results');fs.mkdirSync(OUT,{recursive:true});
const D2R=Math.PI/180,R2D=180/Math.PI,FPM=0.3048/60,KT=0.514444;

/* ---------- aircraft set-up and trim ---------- */
function aircraft(o={}){const E=loadEngine();E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=o.mass||2500;E.cfg.dT=o.dT||0;return E;}
function ctlCopy(E){return {col:E.S.ctl.col,lon:E.S.ctl.lon,lat:E.S.ctl.lat,ped:E.S.ctl.ped};}
/* the autopilot is the trim pilot: it flies the condition, then lets go (controls frozen at the trim) */
function apFly(E,sec,over,each){const {AP,IN,DT}=E;for(let t=0;t<sec;t+=DT){const o=E.apStep(DT);const x=over?over(t,o):{};for(const k of ['col','lon','lat','ped'])IN[k]=x[k]!==undefined?x[k]:o[k];E.step(DT);if(each)each(t);}}
function trimHover(E,altMSL=305){E.reset('high');const g=E.terrainH(E.S.pos[0],E.S.pos[1]);const a=Math.max(altMSL,g+150);E.S.pos[2]=-a;
  Object.assign(E.AP,{on:true,mode:'hover',auto:false,alt:a,vs:0,hdg:0,vN:0,vE:0,posN:E.S.pos[0],posE:E.S.pos[1]});apFly(E,45);E.AP.on=false;return ctlCopy(E);}
function trimCruise(E,kt,altMSL=305){E.reset('cruise');const g=E.terrainH(E.S.pos[0],E.S.pos[1]);const a=Math.max(altMSL,g+150);E.S.pos[2]=-a;E.S.vb[0]=kt*KT;E.S.rot.lam0=0.02;
  Object.assign(E.AP,{on:true,mode:'cruise',auto:false,ias:kt,alt:a,hdg:E.S.eul[2]});apFly(E,60);E.AP.on=false;return ctlCopy(E);}

/* ---------- recording ---------- */
function snap(E,t){const S=E.S,v=E.mrot(E.qmat(S.q),S.vb),va=[S.vb[0]-S.windB[0],S.vb[1]-S.windB[1]],vn=E.mrot(E.qmat(S.q),[S.vb[0]-S.windB[0],S.vb[1]-S.windB[1],S.vb[2]-S.windB[2]]);
  return {t:+t.toFixed(3),phi:S.eul[0]*R2D,theta:S.eul[1]*R2D,psi:S.eul[2]*R2D,p:S.om[0]*R2D,q:S.om[1]*R2D,r:S.om[2]*R2D,
    u:S.vb[0],v:S.vb[1],w:S.vb[2],vN:v[0],vE:v[1],vz_fpm:S.vs/FPM,alt_m:S.alt,hAGL_m:S.hAGL,ias_kt:S.ias/KT,hspd_kt:Math.hypot(vn[0],vn[1])/KT,beta:Math.atan2(va[1],va[0])*R2D,nz:S.nz,
    NR:S.NR,P_kW:(S.Pbar!==undefined?S.Pbar:S.Peng||S.Pload)/1e3,Prot_kW:S.rot.P/1e3,Pfen_kW:S.fen.P/1e3,T_kN:(S.Tbar!==undefined?S.Tbar:S.rot.T)/1e3,col:S.ctl.col,lon:S.ctl.lon,lat:S.ctl.lat,ped:S.ctl.ped,
    ay:S.ay,vrs:S.rot.vrs,stall:S.rot.stall,stallAz:S.rot.stallAz*R2D,fenStall:S.fen.stall,FLI:S.eng.fli};}
/* fly 'sec' seconds; ctl(t,trim) returns the controls (absolute), event(t) may change the state; record at 20 Hz */
function fly(E,sec,ctl,trim,event){const {IN,DT}=E;const ser=[];let next=0;
  for(let i=0,t=0;t<sec+1e-9;i++,t=i*DT){if(event)event(t);const c=ctl?ctl(t,trim):trim;for(const k of ['col','lon','lat','ped'])IN[k]=c[k]!==undefined?c[k]:trim[k];
    if(t>=next-1e-9){ser.push(snap(E,t));next+=0.05;}E.step(DT);}
  return ser;}
/* closed-loop attitude pilot on the raw controls (used where the plan names a piloting task) */
function attPilot(E,thC,phC,I){const S=E.S,[phi,th]=S.eul,[p,q]=S.om;I.l=(I.l===undefined?E.IN.lon:I.l)+(th-thC)*E.DT*0.8;I.r=(I.r===undefined?E.IN.lat:I.r)+(phC-phi)*E.DT*0.8;
  return {lon:Math.max(-1,Math.min(1,2.2*(th-thC)+0.7*q+I.l)),lat:Math.max(-1,Math.min(1,2.4*(phC-phi)-0.6*p+I.r))};}
function hdgPed(E,psiRef,I){const e=((psiRef-E.S.eul[2]+3*Math.PI)%(2*Math.PI))-Math.PI;I.p=Math.max(-1,Math.min(1,(I.p===undefined?E.IN.ped:I.p)+e*E.DT*1.0));return Math.max(-1,Math.min(1,I.p+1.8*e-0.7*E.S.om[2]));}

/* ---------- measuring helpers ---------- */
const at=(s,t,k)=>{let b=s[0];for(const x of s)if(Math.abs(x.t-t)<Math.abs(b.t-t))b=x;return b[k];};
const win=(s,t0,t1)=>s.filter(x=>x.t>=t0-1e-9&&x.t<=t1+1e-9);
const peak=(s,k,t0=0,t1=1e9,sign=0)=>{let b=null;for(const x of win(s,t0,t1)){const v=x[k];if(b===null||(sign>0?v>b[k]:sign<0?v<b[k]:Math.abs(v)>Math.abs(b[k])))b=x;}return {value:+b[k].toFixed(3),t:b.t};};
const r3=v=>v===null||v===undefined?null:+(+v).toFixed(3);
/* heading change from the start to t, unwrapped along the record (a spin of more than half a turn
   must not read as a small change; until 2.0 the difference was taken modulo 360°) */
const hdgChange=(s,t)=>{let d=0;for(let i=1;i<s.length&&s[i].t<=t+1e-9;i++)d+=((s[i].psi-s[i-1].psi+540)%360)-180;return d;};
/* zero crossings of a signal around its mean after t0: period estimate */
function period(s,k,t0){const w=win(s,t0,1e9),m=w.reduce((a,x)=>a+x[k],0)/w.length;const zc=[];for(let i=1;i<w.length;i++){const a=w[i-1][k]-m,b=w[i][k]-m;if(a<0&&b>=0)zc.push(w[i-1].t+(w[i].t-w[i-1].t)*(-a)/(b-a));}
  return zc.length>=2?(zc[zc.length-1]-zc[0])/(zc.length-1):null;}
/* successive peaks of |x - mean| for a damping estimate */
function extrema(s,k,t0){const w=win(s,t0,1e9);const e=[];for(let i=1;i<w.length-1;i++){const a=w[i-1][k],b=w[i][k],c=w[i+1][k];if((b>a&&b>=c)||(b<a&&b<=c))e.push({t:w[i].t,v:b});}
  const out=[];for(const x of e)if(!out.length||Math.abs(x.v-out[out.length-1].v)>0.05)out.push(x);return out;}

/* ---------- the cards ---------- */
const CARDS={
 H1(){const E=aircraft();const tr=trimHover(E);const s=fly(E,5,null,tr);
  const avg=k=>s.reduce((a,x)=>a+x[k],0)/s.length;
  return {s,flown:'2500 kg, 1000 ft ISA, calm; autopilot trimmed the hover for 45 s, then let go; controls frozen at the trim, 5 s recorded',
   metrics:{phi_deg:r3(avg('phi')),theta_deg:r3(avg('theta')),power_total_kW:r3(avg('P_kW')),power_main_rotor_kW:r3(avg('Prot_kW')),power_fenestron_kW:r3(avg('Pfen_kW')),
     ped_rel_centre:r3(tr.ped),lat_rel_centre:r3(tr.lat),lon_rel_centre:r3(tr.lon),collective_fraction_of_range:r3(tr.col),NR_pct:r3(avg('NR')),FLI:r3(avg('FLI'))}};},
 H2(){const E=aircraft();const tr=trimHover(E);const s=fly(E,6,(t,c)=>({lat:c.lat+(t<1?0.1:0)}),tr);
  const vy=s.map(x=>({t:x.t,v:x.vE}));const vpk=vy.reduce((b,x)=>x.v>b.v?x:b,vy[0]);
  return {s,flown:'bare airframe from a trimmed hover: lat +0.10 for 1.0 s, back to trim, other controls fixed',
   metrics:{p_peak:peak(s,'p',0,1.2),p_at_1_5s:r3(at(s,1.5,'p')),phi_peak_change:{value:r3(peak(s,'phi',0,6,1).value-s[0].phi),t:peak(s,'phi',0,6,1).t},phi_change_at_6s:r3(at(s,6,'phi')-s[0].phi),
     lateral_speed_peak:{value:r3(vpk.v),t:vpk.t},q_peak_abs_0_3s:peak(s,'q',0,3),theta_change_at_3s:r3(at(s,3,'theta')-s[0].theta),r_peak_abs:peak(s,'r',0,6)}};},
 H3(){const E=aircraft();const tr=trimHover(E);const s=fly(E,6,(t,c)=>({lon:c.lon+(t<1?0.1:0)}),tr);
  const th0=s[0].theta,mn=peak(s,'theta',0,6,-1);const vx=s.reduce((b,x)=>x.vN>b.vN?x:b,s[0]);
  return {s,flown:'bare airframe from a trimmed hover: lon +0.10 (forward) for 1.0 s, back to trim',
   metrics:{q_peak:peak(s,'q',0,1.3,-1),theta_min_change:{value:r3(mn.value-th0),t:mn.t},forward_speed_peak:{value:r3(vx.vN),t:vx.t},theta_change_at_6s:r3(at(s,6,'theta')-th0),
     p_peak_abs_0_3s:peak(s,'p',0,3),phi_change_at_3s:r3(at(s,3,'phi')-s[0].phi)}};},
 H4(){const E=aircraft();const tr=trimHover(E);const s=fly(E,6,(t,c)=>({ped:c.ped+(t<4?0.1:0)}),tr);
  const pf0=s[0].Pfen_kW,pfMin=Math.min(...win(s,0.5,4).map(x=>x.Pfen_kW));
  return {s,flown:'bare airframe from a trimmed hover: ped +0.10 (right) held 4.0 s, then back to trim; record 6 s',
   metrics:{r_at_1s:r3(at(s,1,'r')),r_at_2s:r3(at(s,2,'r')),r_at_4s:r3(at(s,4,'r')),heading_change_at_6s:r3(hdgChange(s,6)),r_at_5s:r3(at(s,5,'r')),r_at_6s:r3(at(s,6,'r')),
     fenestron_power_trim_kW:r3(pf0),fenestron_power_change_pct:r3((at(s,2,'Pfen_kW')-pf0)/pf0*100),fenestron_power_min_change_pct:r3((pfMin-pf0)/pf0*100),
     phi_change_max:peak(s.map(x=>({...x,dphi:x.phi-s[0].phi})),'dphi'),vz_fpm_max_abs:peak(s,'vz_fpm'),NR_min:r3(Math.min(...s.map(x=>x.NR)))}};},
 H5(){const E=aircraft();const tr=trimHover(E);const s=fly(E,6,(t,c)=>({col:c.col+0.05}),tr);const P0=s[0].P_kW;
  return {s,flown:'bare airframe from a trimmed hover: col +0.05 held, cyclic and pedals fixed',
   metrics:{vertical_accel_peak_g:{value:r3(Math.max(...win(s,0,1).map(x=>x.nz))-1),t:win(s,0,1).reduce((b,x)=>x.nz>b.nz?x:b).t},vz_fpm_at_2s:r3(at(s,2,'vz_fpm')),vz_fpm_at_6s:r3(at(s,6,'vz_fpm')),
     r_at_2s:r3(at(s,2,'r')),r_at_6s:r3(at(s,6,'r')),power_change_pct_at_1s:r3((at(s,1,'P_kW')-P0)/P0*100),power_change_pct_at_5s:r3((at(s,5,'P_kW')-P0)/P0*100),
     NR_min:r3(Math.min(...s.map(x=>x.NR))),NR_at_5s:r3(at(s,5,'NR'))}};},
 H6(){const E=aircraft();const tr=trimHover(E);const s=fly(E,25,null,tr,t=>{if(t===0)E.S.om[1]+=2*D2R;});
  const th0=s[0].theta,ex=extrema(s,'theta',0);const pk=ex.filter(x=>x.v>th0);
  let t2=null;const amp=ex.map(x=>({t:x.t,a:Math.abs(x.v-th0)}));for(let i=1;i<amp.length;i++)if(amp[i].a>=2*amp[0].a){t2=amp[i].t;break;}
  /* doubling time of the oscillation from the growth between successive extrema after the first (the first is the
     forced response to the kick): t2 = dt * ln 2 / ln(a(n+1)/a(n)), averaged over the half-cycles recorded. Until 2.1
     only the time at which an extremum first reached twice the first one was given, which reads as a doubling time
     but is not one (14.2 s where the oscillation doubles in about 5 s). */
  const gr=[];for(let i=2;i<amp.length;i++)if(amp[i-1].a>0.05&&amp[i].a>amp[i-1].a)gr.push((amp[i].t-amp[i-1].t)*Math.LN2/Math.log(amp[i].a/amp[i-1].a));
  const td=gr.length?gr.reduce((a,b)=>a+b,0)/gr.length:null;
  return {s,flown:'bare airframe, controls frozen at the hover trim; at t = 0 a nose-up pitch rate of 2 deg/s is imposed; 25 s',
   metrics:{theta_extrema:ex.slice(0,10).map(x=>({t:x.t,dtheta:r3(x.v-th0)})),theta_period_from_crossings_s:r3(period(s,'theta',2)),first_nose_up_peak:pk.length?{dtheta:r3(pk[0].v-th0),t:pk[0].t}:null,
     doubling_time_from_successive_extrema_s:r3(td),time_until_an_extremum_is_twice_the_first_s:t2,u_at_5s:r3(at(s,5,'u')),phi_max_abs:peak(s.map(x=>({...x,dphi:x.phi-s[0].phi})),'dphi'),v_max_abs:peak(s,'v'),theta_change_at_25s:r3(at(s,25,'theta')-th0)}};},
 H7(){const E=aircraft();const tr=trimHover(E);const s=fly(E,5,(t,c)=>({col:t<1?c.col:Math.max(0,c.col*(1-(t-1)))}),tr,t=>{if(t===0)for(const en of E.S.eng.e)en.fail=true;});
  const nrMin=s.reduce((b,x)=>x.NR<b.NR?x:b,s[0]);
  return {s,flown:'trimmed hover; both engines fail at t = 0; controls fixed 1.0 s; collective lowered to full down over 1.0 s; cyclic and pedals fixed',
   metrics:{r_at_1s:r3(at(s,1,'r')),r_at_2s:r3(at(s,2,'r')),heading_change_at_5s:r3(hdgChange(s,5)),NR_at_0_5s:r3(at(s,0.5,'NR')),NR_at_1s:r3(at(s,1,'NR')),
     NR_decay_rate_first_0_5s_pct_per_s:r3((s[0].NR-at(s,0.5,'NR'))/0.5),NR_min:{value:r3(nrMin.NR),t:nrMin.t},NR_at_5s:r3(at(s,5,'NR')),
     down_accel_g_at_1s:r3(1-at(s,1,'nz')),down_accel_g_peak:{value:r3(1-Math.min(...s.map(x=>x.nz))),t:s.reduce((b,x)=>x.nz<b.nz?x:b).t},vz_fpm_at_5s:r3(at(s,5,'vz_fpm'))}};},
 H8(classical){const E=aircraft();trimHover(E,1220);const {AP,IN,DT}=E;AP.on=true;Object.assign(AP,{mode:'hover',alt:null,vs:-1800*FPM,hdg:E.S.eul[2],vN:0,vE:0,posN:E.S.pos[0],posE:E.S.pos[1]});
  let te=0;for(;te<25;te+=DT){const o=E.apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;E.step(DT);if(te>3&&E.S.vs<-1790*FPM)break;}   // the plan's entry: a vertical descent of 1800 fpm (until 2.1 the first of 1750 fpm or a ring depth of 0.8, which cut the entry at ~1530 fpm)
  const entry={vz_fpm:r3(E.S.vs/FPM),vrs_depth:r3(E.S.rot.vrs),entry_time_s:r3(te)};const c0=E.S.ctl.col,psi0=E.S.eul[2],th0=E.S.eul[1],I={},J={},h0=E.S.alt;const tr=ctlCopy(E);
  const s=classical?fly(E,20,t=>{const c=attPilot(E,th0-10*D2R,0,I);   /* 10° nose down from the entry attitude (until 2.1: to -10°, ~13° below it) */return {lon:c.lon,lat:c.lat,col:Math.min(1,c0+0.15),ped:hdgPed(E,psi0,J)};},tr)
                   :(()=>{AP.on=true;Object.assign(AP,{mode:'hover',vs:0,alt:null,vN:0,vE:0,posN:null,posE:null,hdg:psi0});const out=[];let next=0;
                      for(let i=0,t=0;t<=20+1e-9;i++,t=i*DT){const o=E.apStep(DT);IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;IN.col=Math.min(1,c0+0.15);if(t>=next-1e-9){out.push(snap(E,t));next+=0.05;}E.step(DT);}AP.on=false;return out;})();
  const T=s.map(x=>x.T_kN),Tm=T.reduce((a,b)=>a+b,0)/T.length,nz=win(s,2,20).map(x=>x.nz);
  /* the fluctuation without the slow change the collective step and the deepening descent bring: thrust minus its
     4-s running mean (the same measure test/qualities.js uses for the ring's roughness) */
  const Td=T.map((x,i)=>{const lo=Math.max(0,i-40),hi=Math.min(T.length,i+40);let m=0;for(let j=lo;j<hi;j++)m+=T[j];return x-m/(hi-lo);}).slice(40,-40);
  const tOut=(s.find(x=>x.vz_fpm>-500)||{}).t,tClimb=(s.find(x=>x.vz_fpm>0)||{}).t,t15=(s.find(x=>x.hspd_kt>15)||{}).t;
  return {s,flown:`descent at zero ground speed flown by the autopilot until 1800 fpm (reached: ${entry.vz_fpm} fpm, ring depth ${entry.vrs_depth}); then ${classical?'10 deg nose down from the entry attitude by the attitude pilot, collective +0.15, heading held with the pedals, wings level':'collective +0.15 and held, the autopilot holding zero ground speed and heading with cyclic and pedals'}; 20 s from 4000 ft`,
   metrics:{entry,vz_fpm_at_5s:r3(at(s,5,'vz_fpm')),vz_fpm_at_10s:r3(at(s,10,'vz_fpm')),vz_fpm_at_20s:r3(at(s,20,'vz_fpm')),worst_sink_fpm:r3(Math.min(...s.map(x=>x.vz_fpm))),height_lost_ft:r3((h0-Math.min(...s.map(x=>x.alt_m)))/0.3048),
     time_to_vz_above_minus500_s:tOut===undefined?null:tOut,time_to_climb_s:tClimb===undefined?null:tClimb,time_to_15kt_horizontal_airspeed_s:t15===undefined?null:t15,
     thrust_peak_to_peak_pct:r3((Math.max(...T)-Math.min(...T))/Tm*100),thrust_fluctuation_pp_detrended_4s_pct:r3((Math.max(...Td)-Math.min(...Td))/Tm*100),nz_range_2_20s:[r3(Math.min(...nz)),r3(Math.max(...nz))],power_kW_hover_ref:null,power_kW_max:r3(Math.max(...s.map(x=>x.P_kW))),NR_min:r3(Math.min(...s.map(x=>x.NR))),vrs_depth_at_5s:r3(at(s,5,'vrs'))}};},
 H8a(){return CARDS.H8(false);},H8b(){return CARDS.H8(true);},
 T1(){const E=aircraft();const tr=trimHover(E);const h=E.S.alt;const {AP}=E;AP.on=true;Object.assign(AP,{mode:'hover',alt:h,hdg:E.S.eul[2],posN:null,posE:null,vE:0});const s=[];let next=0;
  apFly(E,48,(t)=>{AP.vN=Math.min(40,t*1.0)*KT;return {};},t=>{if(t>=next-1e-9){s.push(snap(E,t));next+=0.05;}});
  const pick=kt=>{const x=s.find(y=>y.ias_kt>=kt)||s[s.length-1];return x;},P0=s[0].P_kW,x40=pick(39.5);
  const curve=[0,5,10,15,20,25,30,35,40].map(k=>{const x=k===0?s[0]:pick(k);return {kt:k,ias:r3(x.ias_kt),P_kW:r3(x.P_kW),col:r3(x.col),lon:r3(x.lon),lat:r3(x.lat),ped:r3(x.ped),theta:r3(x.theta),phi:r3(x.phi)};});
  const latMin=s.reduce((b,x)=>x.lat<b.lat?x:b,s[0]);
  return {s,flown:'autopilot as the pilot: accelerates at 1 kt/s from the hover to 40 kt (ground speed), holding height with the collective, heading with the pedals and zero sideways speed with the lateral cyclic (wings close to level)',
   metrics:{curve,power_ratio_40kt:r3(x40.P_kW/P0),lon_change_40kt:r3(x40.lon-tr.lon),theta_change_during_accel:r3(Math.min(...win(s,10,40).map(x=>x.theta))-s[0].theta),
     lat_min_change:{value:r3(latMin.lat-tr.lat),ias_kt:r3(latMin.ias_kt)},phi_range:[r3(Math.min(...s.map(x=>x.phi))),r3(Math.max(...s.map(x=>x.phi)))],ped_change_40kt:r3(x40.ped-tr.ped),col_change_40kt:r3(x40.col-tr.col)}};},
 F1(){const pts=[];let s0=null;for(const kt of [0,40,60,80,100,120,135]){const E=aircraft();const tr=kt?trimCruise(E,kt):trimHover(E);const s=fly(E,4,null,tr);if(!s0)s0=s;
   const avg=k=>s.reduce((a,x)=>a+x[k],0)/s.length;pts.push({kt,ias:r3(avg('ias_kt')),P_kW:r3(avg('P_kW')),theta:r3(avg('theta')),col:r3(tr.col),ped:r3(tr.ped),lon:r3(tr.lon)});}
  const mn=pts.reduce((b,x)=>x.P_kW<b.P_kW?x:b,pts[0]);
  return {s:s0,flown:'trimmed level flight (autopilot, 60 s per speed: heading held with the bank; pedals keep the nose on the flight path at 40 kt and centre the ball from 80 kt, blended in between, as a pilot balances), 4 s averages; 2500 kg, 1000 ft ISA',metrics:{points:pts,min_power_speed_kt:mn.kt,Pmin_over_Phover:r3(mn.P_kW/pts[0].P_kW),P135_over_Phover:r3(pts[6].P_kW/pts[0].P_kW),theta_100_minus_hover:r3(pts[4].theta-pts[0].theta)}};},
 F2(){const E=aircraft();const tr=trimCruise(E,100);const s=fly(E,8,(t,c)=>({lon:c.lon+(t<1?0.05:t<2?-0.05:0)}),tr);
  return {s,flown:'bare airframe, trimmed 100 kt: lon +0.05 for 1 s, -0.05 for 1 s, back to trim',
   metrics:{q_min_first_s:peak(s,'q',0,1.2,-1),q_max_second_s:peak(s,'q',1,2.4,1),theta_min_change:{value:r3(peak(s,'theta',0,3,-1).value-s[0].theta),t:peak(s,'theta',0,3,-1).t},theta_change_at_3s:r3(at(s,3,'theta')-s[0].theta),theta_change_at_8s:r3(at(s,8,'theta')-s[0].theta),
     nz_min:peak(s,'nz',0,2,-1),nz_max:peak(s,'nz',0.8,3,1),ias_change_max_abs:r3(Math.max(...s.map(x=>Math.abs(x.ias_kt-s[0].ias_kt)))),p_peak_abs:peak(s,'p',0,8)}};},
 F3(){const E=aircraft();const tr=trimCruise(E,100);const s=fly(E,8,(t,c)=>({lat:c.lat+(t<1?0.1:0)}),tr);const b0=s[0].beta,p0=s[0].phi;
  return {s,flown:'bare airframe, trimmed 100 kt: lat +0.10 for 1 s, back to trim',
   metrics:{p_peak:peak(s,'p',0,1.5,1),phi_change_at_1_5s:r3(at(s,1.5,'phi')-p0),phi_change_at_4s:r3(at(s,4,'phi')-p0),phi_change_at_8s:r3(at(s,8,'phi')-p0),r_min_first_1_5s:peak(s,'r',0,1.5,-1),r_at_4s:r3(at(s,4,'r')),r_at_6s:r3(at(s,6,'r')),r_at_8s:r3(at(s,8,'r')),
     beta_change_peak:{value:r3(peak(s,'beta',0,8,1).value-b0),t:peak(s,'beta',0,8,1).t},beta_trim:r3(b0),q_peak_abs:peak(s,'q',0,8)}};},
 F4(){const E=aircraft();const tr=trimCruise(E,100);const s=fly(E,12,(t,c)=>({ped:c.ped+(t<1?0.1:t<2?-0.1:0)}),tr);const b0=s[0].beta;
  const ex=extrema(s,'r',2);let per=null,zeta=null;if(ex.length>=3){per=(ex[2].t-ex[0].t);const a0=Math.abs(ex[0].v-ex[1].v),a1=Math.abs(ex[1].v-ex[2].v);const dl=Math.log(a0/a1)*2;zeta=dl/Math.sqrt(4*Math.PI*Math.PI+dl*dl);}
  return {s,flown:'bare airframe, trimmed 100 kt: ped +0.10 for 1 s, -0.10 for 1 s, back to trim; 12 s',
   metrics:{r_max_first_s:peak(s,'r',0,1.2,1),r_min_second_s:peak(s,'r',1,2.6,-1),beta_first_peak_change:{value:r3(peak(s,'beta',0,1.6,-1).value-b0),t:peak(s,'beta',0,1.6,-1).t},beta_trim:r3(b0),
     r_extrema_after_release:ex.slice(0,8).map(x=>({t:x.t,r:r3(x.v)})),dutch_roll_period_s:r3(per),dutch_roll_damping_ratio:r3(zeta),phi_change_range:[r3(Math.min(...s.map(x=>x.phi))-s[0].phi),r3(Math.max(...s.map(x=>x.phi))-s[0].phi)],
     heading_change_at_12s:r3(hdgChange(s,12))}};},
 F5(){const E=aircraft();const tr=trimCruise(E,80);const s=fly(E,10,null,tr,t=>{if(t===0)E.S.vb[0]+=5;});const th0=s[0].theta;
  return {s,flown:'bare airframe, trimmed 80 kt, controls fixed; at t = 0 the forward speed is raised by 5 m/s',
   metrics:{q_at_0_5s:r3(at(s,0.5,'q')),q_peak:peak(s,'q',0,4,1),theta_change_at_2s:r3(at(s,2,'theta')-th0),theta_change_max:r3(Math.max(...s.map(x=>x.theta))-th0),vz_fpm_max:r3(Math.max(...s.map(x=>x.vz_fpm))),ias_after_disturbance:r3(s[1].ias_kt),ias_at_10s:r3(at(s,10,'ias_kt'))}};},
 F6(){const E=aircraft();const tr=trimCruise(E,100,1220);/* from 4000 ft: 40 s of autorotation need the height */const {AP,IN,DT}=E;const s=[];let next=0;
  for(const en of E.S.eng.e)en.fail=true;
  for(let i=0,t=0;t<=40+1e-9;i++,t=i*DT){let c;
    if(t<1)c={...tr};else if(t<2)c={...tr,col:tr.col*(2-t)};
    else{if(!AP.on){AP.on=true;Object.assign(AP,{mode:'cruise',auto:true,ias:65,alt:null,vs:0,hdg:E.S.eul[2],pOnly:false});}
      const o=E.apStep(DT);c={lon:o.lon,lat:o.lat,ped:o.ped,col:0};}   // the autopilot flies 65 kt with the cyclic and the ball with the pedals; the collective stays full down as the plan says (until 2.1 it held NR near 100 %)
    Object.assign(IN,c);if(t>=next-1e-9){s.push(snap(E,t));next+=0.05;}E.step(DT);}
  const w=win(s,30,40),avg=k=>w.reduce((a,x)=>a+x[k],0)/w.length,nrMin=s.reduce((b,x)=>x.NR<b.NR?x:b,s[0]);
  return {s,flown:'trimmed 100 kt at 4000 ft (the 40 s of autorotation need the height; from 1000 ft the ground comes first); both engines fail at t = 0; controls fixed 1.0 s; collective full down over 1.0 s; from t = 2 s the autopilot in its autorotation mode flies 65 kt with the cyclic and balances with the pedals (at 65 kt mostly the ball: blended from nose-on-track at 40 kt to ball-centred at 80 kt); the collective stays full down',
   metrics:{r_peak_first_1_5s:peak(s,'r',0,1.5),beta_change_peak_first_2s:r3(peak(s,'beta',0,2).value-s[0].beta),NR_at_1s:r3(at(s,1,'NR')),NR_decay_rate_first_0_5s_pct_per_s:r3((s[0].NR-at(s,0.5,'NR'))/0.5),NR_min:{value:r3(nrMin.NR),t:nrMin.t},
     steady_30_40s:{ias_kt:r3(avg('ias_kt')),vz_fpm:r3(avg('vz_fpm')),NR:r3(avg('NR')),ped:r3(avg('ped')),col:r3(avg('col'))},ped_powered_trim:r3(tr.ped),
     time_vz_within_10pct_of_steady_s:(()=>{const v=avg('vz_fpm');const x=s.find((y,i)=>y.t>2&&s.slice(i).every(z=>Math.abs(z.vz_fpm-v)<0.1*Math.abs(v)));return x?x.t:null;})()}};},
 F7(){const E=aircraft({mass:2910});const tr=trimCruise(E,140);const s=fly(E,5,(t,c)=>({lon:c.lon+(t<2?-0.25:0)}),tr);const p0=s[0].phi;
  const st=s.reduce((b,x)=>x.stall>b.stall?x:b,s[0]);const nzMax=peak(s,'nz',0,5,1);
  const tst=(s.find(x=>x.stall>0.1)||{}).t;
  return {s,flown:'2910 kg, trimmed 140 kt, bare airframe: lon -0.25 (aft) for 2.0 s, back to trim',
   metrics:{nz_peak:nzMax,q_peak:peak(s,'q',0,5,1),theta_change_at_2_5s:r3(at(s,2.5,'theta')-s[0].theta),phi_change_at_3s:r3(at(s,3,'phi')-p0),phi_change_at_5s:r3(at(s,5,'phi')-p0),p_extreme_after_stall_onset:tst===undefined?null:peak(s,'p',tst,5),
     stall_onset_t:tst===undefined?null:tst,nz_at_stall_onset:tst===undefined?null:r3(at(s,tst,'nz')),stalled_fraction_max:{value:r3(st.stall),t:st.t,azimuth_deg_from_tail_in_rotation_direction:r3(st.stallAz)}}};},
 F8(){const E=aircraft();const tr=trimCruise(E,100);let tLat=null,nzMin=9;const s=fly(E,5,(t,c)=>{const x={lon:c.lon+(t<1?0.15:0)};if(tLat!==null&&t>=tLat&&t<tLat+1)x.lat=c.lat+0.15;return x;},tr,t=>{const nz=E.S.nz;if(t>0.3&&tLat===null){nzMin=Math.min(nzMin,nz);if(nz>nzMin+0.03)tLat=t;}});
  const p1=tLat!==null?peak(s,'p',tLat,tLat+1.2,1):null;
  return {s,flown:`bare airframe, trimmed 100 kt: lon +0.15 for 1.0 s; at the lowest load factor (t = ${tLat}) lat +0.15 for 1.0 s`,
   metrics:{nz_min:peak(s,'nz',0,3,-1),lat_input_at_s:tLat,nz_at_lat_input:tLat!==null?r3(at(s,tLat,'nz')):null,p_peak_during_lat:p1,p_before_lat:tLat!==null?r3(at(s,tLat,'p')):null,q_min:peak(s,'q',0,2,-1),theta_min_change:r3(peak(s,'theta',0,5,-1).value-s[0].theta)}};},
 F9(){const E=aircraft();const tr=trimCruise(E,100);const P0=E.S.Peng/1e3;const {AP}=E;AP.on=true;Object.assign(AP,{mode:'cruise',auto:false,ias:100,alt:E.S.alt,hdg:E.S.eul[2]});const I={};const s=[];let next=0;
  apFly(E,45,(t,o)=>{const phC=Math.min(30,t*10)*D2R;const c=attPilot(E,E.S.eul[1],phC,I);return {lat:c.lat};},t=>{if(t>=next-1e-9){s.push(snap(E,t));next+=0.05;}});
  const w=win(s,15,45),avg=k=>w.reduce((a,x)=>a+x[k],0)/w.length;let dpsi=0;for(let i=1;i<w.length;i++)dpsi+=((w[i].psi-w[i-1].psi+540)%360)-180;
  return {s,flown:'trimmed 100 kt; an attitude pilot rolls into 30 deg right bank and holds it with the lateral cyclic; the autopilot holds airspeed (cyclic), height (collective) and ball (pedals); averages over 15–45 s',
   metrics:{bank_deg:r3(avg('phi')),turn_rate_deg_s:r3(dpsi/(w[w.length-1].t-w[0].t)),nz:r3(avg('nz')),power_kW:r3(avg('P_kW')),power_level_kW:r3(P0),power_increase_pct:r3((avg('P_kW')-P0)/P0*100),beta_deg:r3(avg('beta')),ias_kt:r3(avg('ias_kt')),vz_fpm:r3(avg('vz_fpm'))}};},
};

const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'plan.json'),'utf8'));
const want=process.argv.slice(2);
for(const c of plan.cards){if(want.length&&!want.includes(c.id))continue;const t0=Date.now();
  const r=CARDS[c.id]();const keep=['t','phi','theta','psi','p','q','r','u','v','w','vN','vE','vz_fpm','alt_m','ias_kt','hspd_kt','beta','nz','NR','P_kW','Prot_kW','Pfen_kW','T_kN','col','lon','lat','ped','ay','vrs','stall','fenStall','FLI'];
  const series=(r.s||[]).map(x=>{const o={};for(const k of keep)o[k]=+(+x[k]).toFixed(4);return o;});
  fs.writeFileSync(path.join(OUT,c.id+'.json'),JSON.stringify({id:c.id,title:c.title,flown:r.flown,metrics:r.metrics,series},null,0));
  console.log(`${c.id.padEnd(4)} ${((Date.now()-t0)/1000).toFixed(0).padStart(3)} s  ${c.title}`);}
