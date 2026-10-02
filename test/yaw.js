/* Pedal key turn from a trimmed hover through the same keyboard model and
   SAS as the browser: press D for 2 s, release, trace heading and rate. */
const {loadEngine}=require('./load.js');
const E=loadEngine();E.KEYMODEL=process.argv[3]||'new';E.cfg.pedRate=25;E.WIND.spd=0;E.WIND.turb=0;E.cfg.mass=2500;
const {IN,AP,step,apStep,sasApply,trimHandover,DT,RAD,DEG}=E;
const sat=(x,l)=>Math.max(-l,Math.min(l,x));
E.reset('high');AP.on=true;AP.mode='hover';AP.alt=-E.S.pos[2];AP.hdg=0;AP.posN=E.S.pos[0];AP.posE=E.S.pos[1];let o;
for(let t=0;t<12;t+=DT){o=apStep(DT);IN.col=o.col;IN.lon=o.lon;IN.lat=o.lat;IN.ped=o.ped;step(DT);}AP.on=false;trimHandover(o);
E.cfg.sas=true;E.cfg.attHold=true;E.cfg.hdgHold=true;
const press=+(process.argv[2]||2);let psiRel=null,maxR=0,psiMax=-1e9,psiEnd=0;const psi0=E.S.eul[2];
for(let t=0;t<press+8;t+=DT){
  const key=t<press?1:0;const S=E.S;
  // the browser's keyboard model, 'heading' mode (80_input.js)
  const raw={col:o.col,lon:0,lat:0,att:false};
  if(E.KEYMODEL==='new'){raw.yawCmd=key*E.cfg.pedRate*DEG;raw.ped=0;}else raw.ped=key?sat(0.6*(key*60*DEG-S.om[2])+0.3*key,1):0;
  const s=sasApply(DT,raw);IN.col=s.col;IN.lon=s.lon;IN.lat=s.lat;IN.ped=s.ped;step(DT);
  const psi=(S.eul[2]-psi0)*RAD;if(t>=press&&psiRel===null)psiRel=psi;maxR=Math.max(maxR,S.om[2]*RAD);psiMax=Math.max(psiMax,psi);psiEnd=psi;
  if(Math.round(t/DT)%90===0)console.log(`t=${t.toFixed(2).padStart(5)} key=${key} r=${(S.om[2]*RAD).toFixed(1).padStart(6)} °/s  hdg=${psi.toFixed(1).padStart(6)}°  ped=${IN.ped.toFixed(2)}`);
}
console.log(`\nmax rate ${maxR.toFixed(0)} °/s, heading at release ${psiRel.toFixed(0)}°, max ${psiMax.toFixed(0)}°, final ${psiEnd.toFixed(0)}° → overshoot ${(psiMax-psiRel).toFixed(0)}°, swing-back ${(psiMax-psiEnd).toFixed(0)}°`);
