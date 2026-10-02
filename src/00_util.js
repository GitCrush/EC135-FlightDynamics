/* ═══════════════ UTILITIES ═══════════════
   Conventions used throughout:
   body axes  x forward, y right, z down
   earth axes N, E, D (NED); altitude = -D
   angles in rad, SI units, quaternion q = [w,x,y,z] rotating body -> NED */
'use strict';
const DEG=Math.PI/180, RAD=180/Math.PI, KT=0.514444, FT=0.3048, FPM=0.3048/60;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;
const approach=(x,t,d)=>x<t?Math.min(x+d,t):Math.max(x-d,t);
const sat=(x,l)=>clamp(x,-l,l);
const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const v3=(x=0,y=0,z=0)=>[x,y,z];
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vscl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vlen=a=>Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);
const vnorm=a=>{const l=vlen(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
const vaddTo=(a,b)=>{a[0]+=b[0];a[1]+=b[1];a[2]+=b[2];return a;};
/* Rotation matrix (row-major 3x3) from quaternion, body -> NED. */
function qmat(q){const[w,x,y,z]=q;return[
  1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y),
  2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x),
  2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)];}
const mrot=(R,v)=>[R[0]*v[0]+R[1]*v[1]+R[2]*v[2],R[3]*v[0]+R[4]*v[1]+R[5]*v[2],R[6]*v[0]+R[7]*v[1]+R[8]*v[2]];
const mrotT=(R,v)=>[R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
function qfromEuler(phi,th,psi){const c1=Math.cos(phi/2),s1=Math.sin(phi/2),c2=Math.cos(th/2),s2=Math.sin(th/2),c3=Math.cos(psi/2),s3=Math.sin(psi/2);
  return[c1*c2*c3+s1*s2*s3, s1*c2*c3-c1*s2*s3, c1*s2*c3+s1*c2*s3, c1*c2*s3-s1*s2*c3];}
function qtoEuler(q){const[w,x,y,z]=q;
  const phi=Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y));
  const th=Math.asin(clamp(2*(w*y-z*x),-1,1));
  const psi=Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z));return[phi,th,psi];}
/* Quaternion integration with body rates; renormalised every step. */
function qstep(q,om,dt){const[w,x,y,z]=q,[p,qq,r]=om;
  const nw=w+0.5*dt*(-x*p-y*qq-z*r), nx=x+0.5*dt*(w*p+y*r-z*qq), ny=y+0.5*dt*(w*qq-x*r+z*p), nz=z+0.5*dt*(w*r+x*qq-y*p);
  const n=Math.sqrt(nw*nw+nx*nx+ny*ny+nz*nz);return[nw/n,nx/n,ny/n,nz/n];}
const wrapPi=a=>{a=(a+Math.PI)%(2*Math.PI);if(a<0)a+=2*Math.PI;return a-Math.PI;};
/* Deterministic PRNG (mulberry32): the harness needs identical turbulence
   between runs. */
function makeRng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
