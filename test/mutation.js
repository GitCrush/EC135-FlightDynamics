/* Mutation test: are the test suites able to see a wrong model?
   Each mutant breaks the physics on purpose (a sign, a missing term, a
   parameter doubled). The suites run against every mutant through the
   EC135_PATCH hook of the loaders; a mutant counts as caught when a suite
   exits non-zero. A suite that passes a mutant cannot tell that model
   from the real one.

   node test/mutation.js            qualities --fast and consistency (plus a scenario group where a
                                    mutant names one), two mutants at a time
   node test/mutation.js --quick    qualities --fast only
   node test/mutation.js --only=3,7 selected mutants

   The patterns must match the source exactly; a pattern that no longer
   matches is reported as a broken mutant, not as caught. A catch is
   reported as 'physics' when a VAL/CAL/PHY/RULE/consistency/scenario row
   failed, as 'golden only' when only REG rows did: a golden value notices
   change, not error. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const M=[
 ['inflow roll gradient sign reverted (the 1.7 defect)','const CL=Ma[0]/(','const CL=-Ma[0]/('],
 ['blade lift along the shaft, not the blade normal (the 1.7 defect)','const dF=[Ft*th[0]+Fn*e3[0],Ft*th[1]+Fn*e3[1],Fn*e3[2]];','const dF=[Ft*th[0],Ft*th[1],Fn];'],
 ['pitch inertia doubled','I:[2400,0,-650, 0,7000,0, -650,0,4900]','I:[2400,0,-650, 0,14000,0, -650,0,4900]'],
 ['roll inertia doubled','I:[2400,0,-650, 0,7000,0, -650,0,4900]','I:[4800,0,-650, 0,7000,0, -650,0,4900]'],
 ['yaw inertia doubled','I:[2400,0,-650, 0,7000,0, -650,0,4900]','I:[2400,0,-650, 0,7000,0, -650,0,9800]'],
 ['hub stiffness halved: hinge offset 8.7 -> 4.35 % with its own flap frequency','e:0.087, mb:32, nu:1.07,','e:0.0435, mb:32, nu:1.034,'],   // nu alone cannot go below the offset's own value (the spring is clamped at zero)
 ['flap/pitch coupling removed','d3:Math.tan(7.5*DEG),','d3:0,'],
 ['vortex-ring power settling removed','lam0s+=sm(0.55,0.9,w)*0.65*','lam0s+=0*',['scenarios E']],
 ['Fenestron blade stall at 10°','a:5.5, cd0:0.012, aStall:16*DEG,','a:5.5, cd0:0.012, aStall:10*DEG,'],
 ['fuselage drag area +30 %','f:[1.67,6.7,7.0]','f:[2.17,6.7,7.0]'],
 ['turbine lapse without its temperature term','thk:1.016, thb:1.513,','thk:1.016, thb:0,'],
 ['tip loss off','B:0.97,','B:1.2,'],
 ['yaw reaction from the whole engine torque (the 1.7 defect)','const Qdrive=S.eng.Qmast;','const Qdrive=S.eng.Qdrive;'],
 ['rotor speed ignores yaw acceleration','-rt.s*omdShaft)*dt',')*dt'],
 ['horizontal stabiliser removed','stab:{x:-4.90,z:0.15,S:1.35,','stab:{x:-4.90,z:0.15,S:0.01,'],
 ['vertical fin removed','fin:{x:-6.05,z:-1.45,S:1.0,','fin:{x:-6.05,z:-1.45,S:0.01,'],
 ['blade lift slope -20 %','a:5.73,','a:4.6,'],
 ['training-aid mixing out of step with the physics','mix:{roll:-6.78,','mix:{roll:-4,'],
 ['rotor turning clockwise again (the 1.7 sense)','    s:-1,','    s:+1,'],
 ['power-off rotor speed limit back to 110 %','maxAuto:106,','maxAuto:110,'],
 ['governor gains / 5','kp:45e3, ki:20e3,','kp:9e3, ki:4e3,'],
 ['ground effect removed','kG=1-(R/(4*z))*(R/(4*z))/','kG=1-0*(R/(4*z))*(R/(4*z))/'],
 ['fin camber back to the 1.8 value','cl0:0.83,aStall:24*DEG','cl0:0.30,aStall:24*DEG'],
 ['dynamic stall off (static section only)','dsT:10, dsMax:6*DEG,','dsT:0, dsMax:0,'],
 ['vortex-ring roughness cancelled by its own feedback again (the 1.8 defect)','const ctN=rt.sigma*rt.a/4*(st.lamN||0);','const ctN=0;'],
 ['rotor polar inertia at the 1.8 estimate','Ir:2000, Ihub:60,','Ir:1350, Ihub:60,'],
 ['fuselage crossflow with the whole airspeed again (the 2.0 strips: the body as a lifting surface)','const vn=Math.sqrt(vy*vy+vz*vz);','const vn=Math.sqrt(va[0]*va[0]+vy*vy+vz*vz);'],
 ['fuselage yaw moment volume back to 2.0 (-0.45 m³/rad)','Vm:1.0, Vn:-9.5,','Vm:1.0, Vn:-0.45,'],
 ['Fenestron reverse thrust on a quarter of the disc again (the 2.0 inflow)','vi=0.5*vi-0.5*Tm/(2*rho*f.A*V);','vi=0.5*vi-0.5*Tm/(2*rho*f.Am*V);'],
 ['blade torsion off (rigid blades in stall)','cmSep:0.20, Kth:9000,','cmSep:0, Kth:9000,'],
 ['gear mesh losses off','acc:4e3, mesh:0.025,','acc:4e3, mesh:0,'],
 ['fin at the height of the CG again (the 2.0 position)','fin:{x:-6.05,z:-1.45,','fin:{x:-6.05,z:-0.55,'],
 ['Fenestron right stop back to -25° (the 1.9 calibration, made with the quarter-disc reverse relation)','thMin:-11*DEG,','thMin:-25*DEG,'],
];
const args=process.argv.slice(2),quick=args.includes('--quick'),only=(args.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean).map(Number);
const suites=quick?[['qualities',['test/qualities.js','--fast']]]:[['qualities',['test/qualities.js','--fast']],['consistency',['test/consistency.js']]];
const root=path.join(__dirname,'..'),src=fs.readdirSync(path.join(root,'src')).filter(f=>/^\d\d_.*\.js$/.test(f)).map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ec135-mut-'));
function run(file,args,env){return new Promise(res=>{let out='';const p=spawn(process.execPath,args,{cwd:root,env:Object.assign({},process.env,env)});
  p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);p.on('close',code=>res({code,out}));});}
const EXTRA={'scenarios E':['test/scenarios.js','E'],'handling':['test/handling.js']};
async function one(i){const [name,from,to,extra]=M[i];
  if(!src.includes(from))return {i,name,broken:true};
  const pf=path.join(tmp,`m${i}.json`);fs.writeFileSync(pf,JSON.stringify([{from,to}]));const r={i,name,res:{}};
  for(const [sn,a] of suites.concat((extra||[]).map(x=>[x,EXTRA[x]]))){const o=await run(sn,a,{EC135_PATCH:pf});const lines=o.out.split('\n');
    const bad=lines.filter(l=>/^\s+(FAIL|ERROR|CHECK)\b/.test(l)),phys=bad.filter(l=>!/^\s+FAIL\s+REG\b/.test(l));
    r.res[sn]={caught:o.code!==0,phys:phys.length>0||(o.code!==0&&!bad.length),first:((phys[0]||bad[0]||lines.find(l=>/Error/.test(l))||'').trim().replace(/\s+/g,' ')).slice(0,110)};}
  return r;}
(async()=>{const idx=M.map((_,i)=>i+1).filter(i=>!only.length||only.includes(i)).map(i=>i-1);const out=[];let k=0;
  const lane=async()=>{while(k<idx.length){const i=idx[k++];const r=await one(i);out[i]=r;
    if(r.broken){console.log(`  BROKEN  #${i+1} ${r.name}: pattern not found in src/`);continue;}
    const v=Object.values(r.res),c=v.some(x=>x.caught),ph=v.some(x=>x.caught&&x.phys);
    console.log(`  ${c?(ph?'CAUGHT ':'GOLDEN '):'MISSED '} #${String(i+1).padStart(2)} ${r.name.padEnd(60)} ${Object.entries(r.res).map(([sn,x])=>`${sn}: ${x.caught?(x.phys?'yes':'golden'):'no'}`).join('  ')}${c?'\n            '+(v.find(x=>x.caught&&x.phys)||v.find(x=>x.caught)).first:''}`);}};
  await Promise.all([lane(),lane()]);
  const done=out.filter(r=>r&&!r.broken),caught=done.filter(r=>Object.values(r.res).some(x=>x.caught)),phys=caught.filter(r=>Object.values(r.res).some(x=>x.caught&&x.phys));
  console.log(`\n${caught.length} of ${done.length} mutants caught, ${phys.length} of them by a physics, rule or scenario check (the rest by golden values only)`+suites.map(([sn])=>`; ${sn} alone: ${done.filter(r=>r.res[sn].caught).length}`).join(''));
  const broken=out.filter(r=>r&&r.broken).length;if(broken)console.log(`${broken} broken mutant(s): update their patterns`);
  process.exit(caught.length===done.length&&!broken?0:1);})();
