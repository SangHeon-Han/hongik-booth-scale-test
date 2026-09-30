// Lens-space geometry: local +Z is forward, +Y is up; lengths are metres.
export function projectionShape(o) {
  const q=o.projection,[a,b]=q.aspect.split(':').map(Number);
  const width=q.distance/q.ratio,height=width*b/a,r=q.pitch*Math.PI/180;
  const origin=[o.w*.23,o.h*.53,o.d/2+.004];
  const forward=[0,Math.sin(r),Math.cos(r)],up=[0,Math.cos(r),-Math.sin(r)];
  const center=origin.map((v,i)=>v+forward[i]*q.distance+up[i]*q.shift*height);
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>center.map((v,i)=>v+(i===0?x*width/2:0)+up[i]*y*height/2));
  return {origin,center,corners,width,height,forward,up};
}
