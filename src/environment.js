import {width,depth} from './model.js';

// Context only: three empty personal Interaction booths on either side.
// Each booth retains 1.5 m of clear width/depth between shared partitions.
export function neighboringBooths(state) {
  const t=state.walls.thickness,back=-depth(state)/2;
  return [-1,1].flatMap(side=>Array.from({length:3},(_,index)=>({
    x:side*(width(state)/2+t+.75+index*(1.5+t)),
    z:back+.75,w:1.5,d:1.5,h:2,side,
  })));
}

export function neighboringWalls(state) {
  const t=state.walls.thickness;
  return neighboringBooths(state).flatMap(b=>[
    {w:b.w+t,h:b.h,d:t,x:b.x,y:1,z:b.z-b.d/2-t/2},
    {w:t,h:b.h,d:b.d,x:b.x+b.side*(b.w/2+t/2),y:1,z:b.z},
  ]);
}

// One continuous floor, including the working booth, neighbors and aisle.
export const HALL_FLOOR={w:60,h:.1,d:60,x:0,y:-.055,z:0};
