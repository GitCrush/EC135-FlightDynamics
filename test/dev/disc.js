// rotor alone on a fixed hub: apply cyclic, report the tip-path-plane tilt
const {loadEngine}=require('../load.js');
const E=loadEngine();const {H,rotorStep,DT,DEG,RAD}=E;
const rt=H.rotor;
function tpp(st){ // fit beta = b0 + b1c cos(psi) + b1s sin(psi) over the blades; then tilt in hub x/y
  let b0=0,bc=0,bs=0;for(let k=0;k<rt.N;k++){const psi=st.psi+2*Math.PI*k/rt.N;b0+=st.beta[k];bc+=st.beta[k]*Math.cos(psi);bs+=st.beta[k]*Math.sin(psi);}
  b0/=rt.N;bc*=2/rt.N;bs*=2/rt.N;
  // blade at psi: position (-cos psi, -s sin psi). disc height (up) = beta -> tilt: up at aft when bc>0
  // tilt vector = direction where the disc is LOW: low where beta is min
  const tx=bc, ty=rt.s*bs;   // disc high at (-cos,-s sin)·... => low toward (+cos psi_max ...). tx>0 means front low (nose-down tilt)
  return {b0:b0*RAD,tiltFwd:tx*RAD,tiltRight:ty*RAD};
}
for(const [lon,lat] of [[0,0],[4,0],[0,4],[-4,0]]){
  const st=E.S?null:null;
  const s=Object.assign({},{psi:0,Om:rt.Om0,beta:[0.03,0.03,0.03,0.03],betad:[0,0,0,0],lam0:0.055,lamx:0,lamy:0,lamxd:0,lamyd:0,aoa:[],noise:0,noiseT:0,T:0,Q:0,P:0,CT:0,mu:0,lamc:0,vrs:0,ge:1,chi:0,stall:0,stallAz:0,Mtip:0,F:[0,0,0],M:[0,0,0],tipZ:0});
  for(let t=0;t<3;t+=DT)rotorStep(rt,s,DT,[0,0,0],[0,0,0],[0,0,0],[0,0,0],1.225,340,1000,9*DEG,lon*DEG,lat*DEG,s.Q);
  const r=tpp(s);
  console.log(`lon=${lon} lat=${lat}: cone=${r.b0.toFixed(2)} tiltFwd=${r.tiltFwd.toFixed(2)} tiltRight=${r.tiltRight.toFixed(2)}  Mx=${s.M[0].toFixed(0)} My=${s.M[1].toFixed(0)} Fx=${s.F[0].toFixed(0)} Fy=${s.F[1].toFixed(0)} T=${s.T.toFixed(0)}`);
}
