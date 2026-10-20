/* Builds the readable flight-test report from the plan, the frozen cards,
   the pilot's recordings and the evaluator's verdicts.

   node flighttest/report.js                 -> flighttest/report.html (complete page)
   node flighttest/report.js --fragment out  -> page body for hosting that adds its own skeleton */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const D=__dirname,rd=f=>JSON.parse(fs.readFileSync(path.join(D,f),'utf8'));
const plan=rd('plan.json'),cards=rd('cards.json'),ver=rd('verdicts.json');
const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(D,'cards.json'))).digest('hex');
const res={};for(const c of plan.cards){const f=path.join(D,'results',c.id+'.json');if(fs.existsSync(f))res[c.id]=JSON.parse(fs.readFileSync(f,'utf8'));}
/* the earlier flights, kept for comparison: the first (release 1.8) as counts and verdicts, the second
   (release 1.9) also with its recordings, drawn dashed under the third (release 2.1) */
const NOW={n:'4th',name:'fourth',rel:'2.2'};
const EARLIER=[{n:'1st',rel:'1.8'},{n:'2nd',rel:'1.9'},{n:'3rd',rel:'2.1'}].map(f=>({...f,ver:fs.existsSync(path.join(D,'verdicts_'+f.rel+'.json'))?rd('verdicts_'+f.rel+'.json'):null})).filter(f=>f.ver);
for(const f of EARLIER){f.vmap={};for(const c of f.ver.cards)f.vmap[c.id]=c;f.cnt={PASS:0,NEAR:0,FAIL:0,'N/A':0};f.ccnt={PASS:0,MIXED:0,FAIL:0};for(const c of f.ver.cards){f.ccnt[c.verdict]++;for(const e of c.expectations)f.cnt[e.verdict]=(f.cnt[e.verdict]||0)+1;}}
const PREV=EARLIER[EARLIER.length-1];
const ver0=EARLIER.length?EARLIER[0].ver:null,ver1=EARLIER.length>1?EARLIER[1].ver:null;
const res0={};for(const c of plan.cards){const f=path.join(D,'results_'+PREV.rel,c.id+'.json');if(fs.existsSync(f))res0[c.id]=JSON.parse(fs.readFileSync(f,'utf8'));}
const esc=s=>String(s===undefined||s===null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* which signals each card plots: [field, label, unit] per panel; x is time unless noted */
const PLOTS={
 H1:[['phi','roll attitude','deg'],['theta','pitch attitude','deg']],
 H2:[['p','roll rate p','deg/s'],['phi','roll attitude','deg'],['r','yaw rate r','deg/s']],
 H3:[['q','pitch rate q','deg/s'],['theta','pitch attitude','deg'],['vN','speed north','m/s']],
 H4:[['r','yaw rate r','deg/s'],['Pfen_kW','Fenestron power','kW'],['phi','roll attitude','deg']],
 H5:[['vz_fpm','vertical speed','fpm'],['r','yaw rate r','deg/s'],['NR','rotor speed','%']],
 H6:[['theta','pitch attitude','deg'],['phi','roll attitude','deg'],['u','forward speed u','m/s']],
 H7:[['NR','rotor speed','%'],['r','yaw rate r','deg/s'],['vz_fpm','vertical speed','fpm']],
 H8a:[['vz_fpm','vertical speed','fpm'],['T_kN','rotor thrust','kN'],['vrs','vortex-ring depth','']],
 H8b:[['vz_fpm','vertical speed','fpm'],['hspd_kt','horizontal airspeed','kt'],['vrs','vortex-ring depth','']],
 T1:[['P_kW','engine load','kW','hspd_kt'],['ped','pedal (+ right)','','hspd_kt'],['lat','lateral cyclic (+ right)','','hspd_kt']],
 F2:[['q','pitch rate q','deg/s'],['theta','pitch attitude','deg'],['nz','load factor','g']],
 F3:[['p','roll rate p','deg/s'],['phi','roll attitude','deg'],['beta','sideslip','deg']],
 F4:[['r','yaw rate r','deg/s'],['beta','sideslip','deg'],['phi','roll attitude','deg']],
 F5:[['theta','pitch attitude','deg'],['vz_fpm','vertical speed','fpm'],['ias_kt','airspeed','kt']],
 F6:[['NR','rotor speed','%'],['r','yaw rate r','deg/s'],['vz_fpm','vertical speed','fpm']],
 F7:[['nz','load factor','g'],['phi','roll attitude','deg'],['stall','stalled part of the disc','']],
 F8:[['nz','load factor','g'],['p','roll rate p','deg/s'],['q','pitch rate q','deg/s']],
 F9:[['phi','roll attitude','deg'],['nz','load factor','g'],['P_kW','engine load','kW']],
};
function nice(lo,hi){if(lo===hi){lo-=1;hi+=1;}const span=hi-lo,st=Math.pow(10,Math.floor(Math.log10(span/4)));const step=[1,2,2.5,5,10].map(m=>m*st).find(s=>span/s<=6)||10*st;
  return {lo:Math.floor(lo/step)*step,hi:Math.ceil(hi/step)*step,step};}
function fmt(v){const a=Math.abs(v);return a>=1000?v.toFixed(0):a>=10?(+v.toFixed(1)).toString():(+v.toFixed(2)).toString();}
function plot(series,key,label,unit,xkey,series0){
  const s0=series0&&series0.length&&series0[0][key]!==undefined?series0:null;
  const W=320,H=158,L=44,R=10,T=14,B=32,xs=series.map(p=>p[xkey||'t']).concat(s0?s0.map(p=>p[xkey||'t']):[]),ys=series.map(p=>p[key]).concat(s0?s0.map(p=>p[key]):[]);
  const xr=nice(Math.min(...xs),Math.max(...xs)),yr=nice(Math.min(...ys),Math.max(...ys));
  const X=x=>L+(x-xr.lo)/(xr.hi-xr.lo)*(W-L-R),Y=y=>T+(yr.hi-y)/(yr.hi-yr.lo)*(H-T-B);
  let g='';for(let y=yr.lo;y<=yr.hi+1e-9;y+=yr.step)g+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${Y(y).toFixed(1)}" y2="${Y(y).toFixed(1)}"/><text class="tick" x="${L-5}" y="${(Y(y)+3.5).toFixed(1)}" text-anchor="end">${fmt(y)}</text>`;
  for(let x=xr.lo;x<=xr.hi+1e-9;x+=xr.step)g+=`<text class="tick" x="${X(x).toFixed(1)}" y="${H-B+14}" text-anchor="middle">${fmt(x)}</text>`;
  if(yr.lo<0&&yr.hi>0)g+=`<line class="zero" x1="${L}" x2="${W-R}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`;
  const d=series.map((p,i)=>`${i?'L':'M'}${X(p[xkey||'t']).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join('');
  const d0=s0?s0.map((p,i)=>`${i?'L':'M'}${X(p[xkey||'t']).toFixed(1)} ${Y(p[key]).toFixed(1)}`).join(''):'';
  return `<figure class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} against ${xkey?'airspeed':'time'}">${g}${d0?`<path class="trace0" d="${d0}"/>`:''}<path class="trace" d="${d}"/><text class="xl" x="${W-R}" y="${H-3}" text-anchor="end">${xkey?'horizontal airspeed, kt':'time, s'}</text></svg><figcaption>${esc(label)}${unit?` <span>${esc(unit)}</span>`:''}</figcaption></figure>`;}
function f1Plots(m,m0){const pick=m=>m?m.points.map(p=>({kt:p.kt,P_kW:p.P_kW,ped:p.ped,theta:p.theta})):null;const s=pick(m),s0=pick(m0);
  return plot(s,'P_kW','engine load','kW','kt',s0)+plot(s,'ped','trim pedal (+ right)','','kt',s0)+plot(s,'theta','pitch attitude','deg','kt',s0);}

/* what changed between the first and second flight (release 1.9), with the calibrations against card sources disclosed */
const CHANGES19=[
 '<b>Test pilot, balance technique.</b> In the first flight the autopilot that trims each condition turned the ball toward the centre so slowly that it never got there within its minute, and its pedal integrator stopped at 0.4: the high-speed pedal positions of F1 (and H1.4) were partly this limit. Now the bank holds the heading and the pedals keep the nose on the flight path at 40 kt and centre the ball from 80 kt, blended in between. Affects F1, F6, F9 and every trim.',
 '<b>Fin camber, calibrated to Airbus IN 3540</b> (the source of F1.6, F6.4 and H1.4): the fin now carries about two thirds of the anti-torque in balanced cruise. With it, the Fenestron pedal gearing got a larger reverse range (right stop −25° instead of −10°) so that the steady autorotation can be balanced short of the stop.',
 '<b>Rotor polar inertia 2000 kg m², calibrated to the Airbus simulation quoted in AAIB AAR 3/2015</b> (also a source of H7 and F6): 1350 kg m² before.',
 '<b>Yaw inertia 6300 kg m², calibrated to the DLR Dutch roll at 60 kt</b> (the source of F4.3): 5000 kg m² before.',
 '<b>Vortex-ring roughness</b>: slower, and no longer cancelled by the model\'s own recirculation feedback; its amplitude was set with the 10–40 % band of H8a.3 in view.',
 '<b>Physics without calibration:</b> dynamic stall of the rotor blades (F7); the Fenestron duct\'s ram drag and the rotor downwash across the fuselage (hover yaw damping, H4); the frontal drag area re-fitted to 137 kt at maximum continuous power once the Fenestron no longer absorbed 50–60 kW there.',
 '<b>Recordings:</b> rotor thrust and engine power are now one-revolution averages (the four-per-revolution of the rotor aliased into ±12 kN jumps at 20 Hz), and the lateral specific force (the slip ball) is recorded.',
];
/* what changed between the third and fourth flight (release 2.2): the test pilot only; the flight model is the same */
const CHANGES22=[
 '<b>The flight model is unchanged.</b> The fourth flight checks the test pilot, which the third evaluator found off the plan in three places, and gives the last open items their final reading (the developer\'s notes in the card tables).',
 '<b>H8a and H8b, vortex-ring entry:</b> the recovery now starts at the plan\'s 1,800 fpm of vertical descent. Until 2.1 the pilot started it at the first of 1,750 fpm or a ring depth of 0.8, which cut the entry at ~1,530 fpm.',
 '<b>H8b, classical recovery:</b> 10° nose down from the entry attitude, as the plan says (until 2.1 to −10°, about 13° below it).',
 '<b>F6, autorotation:</b> the collective stays full down after the failure, as the plan says. Until 2.1 the autopilot\'s autorotation mode lifted it a little to hold NR near 100 %.',
 '<b>H6, recording:</b> a doubling time from the growth of successive extrema is added. The old measure, the time at which an extremum first reached twice the first one (14.2 s), read like a doubling time but is not one; the evaluator had computed 4.8 s from the record.',
 '<b>H8a and H8b, recording:</b> the thrust fluctuation is also given without the slow change from the collective step and the deepening descent (thrust minus its 4-s running mean), as the qualities suite measures the ring\'s roughness.',
];
/* what changed between the second and third flight (release 2.1); calibrations against card sources disclosed */
const CHANGES21=[
 '<b>Fuselage side force by the crossflow principle, calibrated to Kampa et al. 1997, Fig. 18</b> (the EC135 derivative breakdown; the same paper is a source of several cards). Until 2.0 the cabin and tail-boom strips took the whole airspeed into their crossflow, which made the fuselage weathercock-stable (+0.06 m³/°) and gave it a yaw damping of −0.25 1/s at 90 kt; Kampa gives −0.26 m³/° (destabilising) and about zero. Now each strip feels only the flow across the body, the cabin adds a low-aspect-ratio side force near the CG, and the fuselage yaw moment volume was set to the published value. This is the change behind the longer Dutch-roll period (F3, F4).',
 '<b>Yaw inertia 4900 kg m², calibrated again to the DLR Dutch roll at 60 kt</b> (the source of F4.3; 6300 kg m² in 1.9, fitted then to a fuselage that damped yaw by itself).',
 '<b>Fin: camber 0.83 and the centre of pressure 1.45 m above the CG.</b> The camber is set with Airbus IN 3540 (zero Fenestron thrust in ball-centred cruise at 120 kt; source of F1.6 and H1.4); the height with the fin-and-Fenestron dihedral effect of Kampa Fig. 18 (−0.12 m³/°).',
 '<b>Fenestron.</b> Physics: reverse thrust now comes from the fan\'s own disc area (until 2.0 a quarter of it, which in cruise, where the fan runs near zero thrust, cancelled most of its response to sideslip); the duct\'s augmentation fades faster with flight speed across the duct than with the rotor downwash. <b>Calibrated: the right-stop fan pitch, −11° (1.9: −25°), set again with IN 3540</b> (reverse thrust near the right stop in autorotation; source of F6.4), since the corrected relation needs less pitch for the same reverse thrust.',
 '<b>Rotor blades twist under stall</b> (physics, parameters estimated): the separated-flow pitching moment of stalled sections twists the blade nose-down through the torsional stiffness of blade and control path, so a deep stall limits itself instead of rolling the aircraft over (F7).',
 '<b>Fuselage vertical force</b> by the same crossflow principle plus the cabin\'s lift: at 140 kt the fuselage no longer presses down with 1.6 kN that the rotor had to carry. The frontal drag area was fitted again to 137 kt at maximum continuous power (1.67 m²; a calibration as before).',
 '<b>Drive train:</b> gear mesh losses (2.5 %), accessories on the main gearbox 4 kW (the generators sit on the engines and leave the rotor with them after a double engine failure, H7), and the FADEC sees the load through a 0.15 s filter. The turbine lapse was fitted again to the published hover ceilings (a calibration as before).',
 '<b>Test pilot:</b> heading changes are now summed along the record. Until 1.9 they were taken modulo 360°, so a spin of −545° (H7) was recorded as +175°.',
];
/* the developer's reading of discrepancies the model keeps on purpose (physics, or the source does not fit the type) */
const NOTES=fs.existsSync(path.join(D,'notes.json'))?rd('notes.json'):{};
const vmap={};for(const c of ver.cards)vmap[c.id]=c;
const cmap={};for(const c of cards.cards)cmap[c.id]=c;
const cnt={PASS:0,NEAR:0,FAIL:0,'N/A':0};for(const c of ver.cards)for(const e of c.expectations)cnt[e.verdict]=(cnt[e.verdict]||0)+1;
const ccnt={PASS:0,MIXED:0,FAIL:0};for(const c of ver.cards)ccnt[c.verdict]++;
const total=Object.values(cnt).reduce((a,b)=>a+b,0);
const pill=v=>`<span class="pill v-${esc(v).replace('/','')}">${esc(v)}</span>`;
const srcKey={};for(const s of cards.sources)srcKey[s.key]=s;

let cardsHtml='';
for(const p of plan.cards){const v=vmap[p.id]||{},c=cmap[p.id]||{},r=res[p.id]||{};const exps=(c.expectations||[]);
  const r0=res0[p.id]||{};
  const plots=p.id==='F1'?f1Plots(r.metrics,r0.metrics):(PLOTS[p.id]||[]).map(([k,l,u,xk])=>r.series&&r.series.length&&r.series[0][k]!==undefined?plot(r.series,k,l,u,xk,r0.series):'').join('');
  const rows=exps.map(e=>{const ve=(v.expectations||[]).find(x=>x.id===e.id)||{};const dn=ve.verdict&&ve.verdict!=='PASS'&&NOTES[e.id];
    const was=EARLIER.slice().reverse().map(f=>{const c=f.vmap[p.id];const x=c&&(c.expectations||[]).find(y=>y.id===e.id);return x&&x.verdict?`<div class="was">${f.n} flight: ${esc(x.verdict)}</div>`:'';}).join('');
    return `<tr><td class="eid">${esc(e.id)}</td><td><b>${esc(e.quantity)}</b><div class="exp">${esc(e.expected)}</div><div class="src">${esc(e.source)} · confidence ${esc(e.confidence)}</div></td><td><div>${esc(ve.observed)}</div>${ve.comment?`<div class="cm">${esc(ve.comment)}</div>`:''}${dn?`<div class="dev"><b>Developer:</b> ${esc(dn)}</div>`:''}</td><td>${pill(ve.verdict||'—')}${was}</td></tr>`;}).join('');
  cardsHtml+=`<section class="card" id="${esc(p.id)}"><header><div class="cid">${esc(p.id)}</div><h3>${esc(p.title)}</h3>${pill(v.verdict||'—')}</header>
<p class="headline">${esc(v.headline)}</p>
<dl class="meta"><div><dt>Condition</dt><dd>${esc(p.condition)}</dd></div><div><dt>Input</dt><dd>${esc(p.inputs)}</dd></div><div><dt>As flown</dt><dd>${esc(r.flown)}</dd></div></dl>
<div class="plots">${plots}</div>${r0.series||r0.metrics?`<p class="legend"><span class="sw"></span> ${NOW.name} flight (release ${NOW.rel}) <span class="sw0"></span> ${PREV.n} flight (${PREV.rel}) · card verdict before: ${EARLIER.map(f=>f.vmap[p.id]?`${f.n} ${esc(f.vmap[p.id].verdict)}`:'').filter(Boolean).join(', ')}</p>`:''}
<div class="tablewrap"><table><thead><tr><th>#</th><th>Expected (written blind, from sources)</th><th>Observed</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>
${(v.red_flags_seen||[]).length?`<div class="flags"><b>Red flags seen:</b> ${v.red_flags_seen.map(esc).join(' · ')}</div>`:''}
${c.notes?`<p class="note"><b>Author's note:</b> ${esc(c.notes)}</p>`:''}</section>`;}

const chips=plan.cards.map(p=>{const v=(vmap[p.id]||{}).verdict||'—';return `<a class="chip v-${v}" href="#${esc(p.id)}"><b>${esc(p.id)}</b><span>${esc(p.title)}</span></a>`;}).join('');
const sources=cards.sources.map(s=>`<li><b>${esc(s.key)}</b> ${esc(s.ref)}${s.url?` <a href="${esc(s.url)}" target="_blank" rel="noopener">link</a>`:''}</li>`).join('');
const bar=['PASS','NEAR','FAIL','N/A'].filter(k=>cnt[k]).map(k=>`<span class="seg v-${k.replace('/','')}" style="flex:${cnt[k]}" title="${k}: ${cnt[k]}"></span>`).join('');

const css=`
/* layout: one reading column of test cards, each card a sheet with its plots and its verdict table */
:root{--bg:#eef1f2;--sheet:#fbfcfc;--ink:#18242c;--mute:#5a6a74;--rule:#cfd8dd;--accent:#0a6a85;--trace:#0a6a85;--pass:#2c7a4b;--near:#9a6400;--fail:#b02a22;--na:#6b7880;
 --f-disp:"Barlow Semi Condensed","Arial Narrow",sans-serif;--f-body:"Source Sans 3","Segoe UI",system-ui,sans-serif;--f-data:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1418;--sheet:#151d22;--ink:#dce5ea;--mute:#93a3ad;--rule:#2a363d;--accent:#5bc0dc;--trace:#5bc0dc;--pass:#5fbf84;--near:#e0a640;--fail:#ef6f62;--na:#93a3ad;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0e1418;--sheet:#151d22;--ink:#dce5ea;--mute:#93a3ad;--rule:#2a363d;--accent:#5bc0dc;--trace:#5bc0dc;--pass:#5fbf84;--near:#e0a640;--fail:#ef6f62;--na:#93a3ad;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:16px/1.55 var(--f-body);margin:0}
.wrap{max-width:1060px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 64px}
h1,h2,h3{font-family:var(--f-disp);font-weight:600;letter-spacing:.01em;text-wrap:balance;margin:0}
h1{font-size:clamp(30px,5vw,44px);line-height:1.08}
h2{font-size:24px;margin-top:40px;margin-bottom:12px}
.kicker{font:600 13px var(--f-data);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.lede{max-width:68ch;color:var(--ink);font-size:17px}
.prose{max-width:68ch}
.hashline{font:12px var(--f-data);color:var(--mute);overflow-wrap:anywhere}
.tally{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0 8px}
.tally div{background:var(--sheet);border:1px solid var(--rule);border-radius:6px;padding:12px 14px}
.tally b{display:block;font:600 30px var(--f-disp);font-variant-numeric:tabular-nums}
.tally span{font-size:13px;color:var(--mute)}
.bar{display:flex;height:10px;border-radius:5px;overflow:hidden;margin:6px 0 4px;gap:2px}
.seg.v-PASS{background:var(--pass)}.seg.v-NEAR{background:var(--near)}.seg.v-FAIL{background:var(--fail)}.seg.v-NA{background:var(--na)}
.chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin:12px 0}
.chip{display:flex;gap:10px;align-items:baseline;padding:8px 10px;border-radius:6px;background:var(--sheet);border:1px solid var(--rule);border-left:4px solid var(--na);color:var(--ink);text-decoration:none;font-size:14px;min-width:0}
.chip b{font-family:var(--f-data);font-size:13px}.chip span{color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.chip.v-PASS{border-left-color:var(--pass)}.chip.v-MIXED{border-left-color:var(--near)}.chip.v-FAIL{border-left-color:var(--fail)}
.chip:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
ol.find{padding-left:22px;max-width:76ch}ol.find li{margin:6px 0}
.card{background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:18px 18px 14px;margin:18px 0;scroll-margin-top:12px}
.card header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cid{font:600 14px var(--f-data);color:var(--accent);border:1.5px solid var(--accent);border-radius:4px;padding:1px 7px}
.card h3{font-size:22px;flex:1;min-width:0}
.headline{font-size:16.5px;margin:10px 0 6px;max-width:76ch}
.meta{display:grid;grid-template-columns:1fr;gap:4px;margin:8px 0 10px;font-size:14px}
.meta div{display:grid;grid-template-columns:84px 1fr;gap:10px}.meta dt{color:var(--mute);font:600 12px var(--f-data);text-transform:uppercase;letter-spacing:.06em;padding-top:2px}.meta dd{margin:0;min-width:0}
.plots{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin:8px 0 12px}
.plot{margin:0;min-width:0}.plot svg{width:100%;height:auto;display:block}
.plot figcaption{font-size:13px;color:var(--ink);margin-top:2px}.plot figcaption span{color:var(--mute);font-family:var(--f-data);font-size:12px}
.grid{stroke:var(--rule);stroke-width:1}.zero{stroke:var(--mute);stroke-width:1;stroke-dasharray:3 3}
.tick{fill:var(--mute);font:10px var(--f-data)}.xl{fill:var(--mute);font:10px var(--f-body)}
.trace{fill:none;stroke:var(--trace);stroke-width:1.8;stroke-linejoin:round}
.trace0{fill:none;stroke:var(--mute);stroke-width:1.3;stroke-dasharray:4 3;stroke-linejoin:round;opacity:.8}
.legend{font-size:12.5px;color:var(--mute);margin:-4px 0 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.legend .sw,.legend .sw0{display:inline-block;width:22px;height:0;border-top:2px solid var(--trace);vertical-align:middle}.legend .sw0{border-top:1.5px dashed var(--mute);margin-left:8px}
.was{font:11px var(--f-data);color:var(--mute);margin-top:4px;white-space:nowrap}
.dev{font-size:13px;color:var(--ink);margin-top:6px;padding-left:8px;border-left:2px solid var(--accent)}.dev b{color:var(--accent);font-weight:600}
h3.sub{font-size:18px;margin:18px 0 4px}
table.hist{min-width:520px;width:auto;margin:14px 0 6px}table.hist th,table.hist td{width:auto!important;white-space:nowrap;padding-right:22px}table.hist td{font-variant-numeric:tabular-nums}table.hist tr.now td{font-weight:600}
ul.chg{max-width:78ch;padding-left:20px}ul.chg li{margin:6px 0}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:620px}
th{text-align:left;font:600 12px var(--f-data);text-transform:uppercase;letter-spacing:.06em;color:var(--mute);border-bottom:1.5px solid var(--rule);padding:6px 8px}
td{vertical-align:top;border-bottom:1px solid var(--rule);padding:8px}
td.eid{font-family:var(--f-data);font-size:12.5px;white-space:nowrap;color:var(--mute)}
.exp{margin-top:2px}.src{font-size:12px;color:var(--mute);margin-top:3px}.cm{font-size:13px;color:var(--mute);margin-top:4px}
td:nth-child(2){width:42%}td:nth-child(3){width:40%}
.pill{display:inline-block;font:600 12px var(--f-data);letter-spacing:.05em;padding:2px 8px;border-radius:999px;border:1.5px solid currentColor;white-space:nowrap}
.pill.v-PASS{color:var(--pass)}.pill.v-NEAR,.pill.v-MIXED{color:var(--near)}.pill.v-FAIL{color:var(--fail)}.pill.v-NA{color:var(--na)}
.flags{font-size:14px;color:var(--fail);margin:10px 0 0}
.note{font-size:13.5px;color:var(--mute);margin:10px 0 0;max-width:90ch}
ul.src{font-size:14px;padding-left:20px}ul.src li{margin:4px 0;overflow-wrap:anywhere}
a{color:var(--accent)}
.roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:12px 0}
.roles div{background:var(--sheet);border:1px solid var(--rule);border-radius:6px;padding:12px 14px;font-size:14.5px}
.roles b{font-family:var(--f-disp);font-size:18px;display:block;margin-bottom:4px}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;
const body=`<div class="wrap">
<p class="kicker">EC135 Flight Dynamics · release ${NOW.rel} · ${NOW.name} flight</p>
<h1>EC135 Simulated Flight Test</h1>
<p class="lede">No test pilot was available, so the flight test was split into three roles that never saw each other's work. An author wrote down, from published sources only, what a real EC135 P2+ does in ${plan.cards.length} manoeuvres. A scripted pilot flew exactly those manoeuvres in the simulator. An evaluator, who saw the expectations and the recordings but not the model, judged every expectation.</p>
<div class="roles"><div><b>Author</b>Expected behaviour from textbooks, the FAA handbook, Airbus notices, the EASA type certificate and DLR measurements. ${cards.cards.reduce((a,c)=>a+c.expectations.length,0)} expectations with ranges, sources and confidence; frozen before the flight.</div><div><b>Test pilot</b>A script flies the inputs of the plan: steps, pulses, doublets from a trimmed state with no stability augmentation, and closed-loop tasks where the plan names one.</div><div><b>Evaluator</b>Compares each recording with its card: PASS, NEAR (right shape, number somewhat outside), FAIL (wrong sign or far off), N/A.</div></div>
<p class="hashline">Cards frozen as cards.json, SHA-256 ${hash}</p>
<h2>Result</h2>
<div class="tally"><div><b>${cnt.PASS}</b><span>expectations PASS</span></div><div><b>${cnt.NEAR}</b><span>NEAR</span></div><div><b>${cnt.FAIL}</b><span>FAIL</span></div><div><b>${ccnt.PASS} / ${ccnt.MIXED} / ${ccnt.FAIL}</b><span>cards PASS / MIXED / FAIL</span></div></div>
<div class="bar" role="img" aria-label="${cnt.PASS} pass, ${cnt.NEAR} near, ${cnt.FAIL} fail of ${total}">${bar}</div>
${EARLIER.length?`<div class="tablewrap"><table class="hist"><thead><tr><th>Flight</th><th>Release</th><th>PASS</th><th>NEAR</th><th>FAIL</th><th>N/A</th><th>Cards PASS / MIXED / FAIL</th></tr></thead><tbody>
${EARLIER.map(f=>`<tr><td>${f.n}</td><td>${f.rel}</td><td>${f.cnt.PASS}</td><td>${f.cnt.NEAR}</td><td>${f.cnt.FAIL}</td><td>${f.cnt['N/A']||0}</td><td>${f.ccnt.PASS} / ${f.ccnt.MIXED} / ${f.ccnt.FAIL}</td></tr>`).join('')}
<tr class="now"><td>${NOW.n}</td><td>${NOW.rel}</td><td>${cnt.PASS}</td><td>${cnt.NEAR}</td><td>${cnt.FAIL}</td><td>${cnt['N/A']||0}</td><td>${ccnt.PASS} / ${ccnt.MIXED} / ${ccnt.FAIL}</td></tr></tbody></table></div>
<p class="prose">Each flight was judged by a new evaluator who saw neither the model nor the earlier verdicts. The cards stayed the same; between the flights the model and the test pilot changed (below). Evaluators differ at the margins: on the same or nearly the same recording an expectation has been rated PASS by one and NEAR by the next.</p>`:''}
<p class="prose">${esc(ver.summary)}</p>
<div class="chips">${chips}</div>
${ver1?`<h2>Between the flights</h2>
<p class="prose">The cards stayed frozen (same SHA-256). The model and the test pilot changed. Some changes were fitted to the same published sources the author used for the cards; the cards that rest on those sources are therefore no longer independent checks of them.</p>
<h3 class="sub">Before the fourth flight (release 2.2)</h3>
<ul class="chg">${CHANGES22.map(c=>`<li>${c}</li>`).join('')}</ul>
<h3 class="sub">Before the third flight (release 2.1)</h3>
<ul class="chg">${CHANGES21.map(c=>`<li>${c}</li>`).join('')}</ul>
<h3 class="sub">Before the second flight (release 1.9)</h3>
<ul class="chg">${CHANGES19.map(c=>`<li>${c}</li>`).join('')}</ul>`:''}
<h2>The finding that came first</h2>
<p class="prose">Writing the cards, the author noticed that the plan described the EC135's main rotor as turning clockwise seen from above, the way the simulator had it since its first version. It turns counterclockwise, like the BO105 and BK117 it descends from: Airbus Helicopters Information Notice IN 3540-I-00 lists the EC135 P2+ among the types with a counterclockwise rotor, and the flight manual describes a double engine failure as a "yawing motion nose left". Every effect that depends on the sense was mirrored: the pedal that goes with power, the low skid in the hover, the yaw at a power loss, the retreating side. The model was corrected before the flight, and the cards were not touched.</p>
<h2>Main discrepancies</h2>
<ol class="find">${ver.top_findings.map(f=>`<li>${esc(f)}</li>`).join('')}</ol>
<p class="prose">These are the open items after the fourth flight, in the evaluator's words. Where the developer thinks a discrepancy comes from the physics of the type rather than from the model, the card table says why, marked <b>Developer</b>; that is the developer's reading, not the evaluator's. The cards stay frozen, so the same flight test can be flown again after each change and the result compared.</p>
<h2>The cards</h2>
${cardsHtml}
<h2>Method</h2>
<p class="prose">${esc(cards.author_note)}</p>
<p class="prose">${esc(ver.method)}</p>
<p class="prose">Plots show what the scripted pilot recorded at 20 Hz. Airspeed in the vortex-ring cards is the horizontal component, since the indicated airspeed of a vertical descent is mostly sink rate.</p>
<h2>Sources used by the author</h2>
<ul class="src">${sources}</ul>
</div>`;
const head=`<title>EC135 Simulated Flight Test</title>
<style>${css}</style>`;
const args=process.argv.slice(2);
if(args[0]==='--fragment'){fs.writeFileSync(args[1],head+'\n'+body+'\n');console.log('fragment written: '+args[1]);}
else{fs.writeFileSync(path.join(D,'report.html'),`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n</head><body>\n${body}\n</body></html>\n`);console.log('flighttest/report.html written');}
