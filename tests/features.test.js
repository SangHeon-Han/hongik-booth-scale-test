import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,item,validate,world,setWorld,issues,clone} from '../src/model.js';
import {createProject,validateProject,switchLayout,copyLayout} from '../src/project.js';
import {projectionShape} from '../src/projection.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('v2 migration halves human depth and preserves all poses',()=>{
  const old=initialState();old.version=2;delete old.options.lighting;delete old.items[1].screen;
  old.items[2].d=old.items[2].h*.1;old.items[2].rotation=37;
  const before=clone(old),next=validate(old);
  assert.deepEqual(old,before);near(next.items[2].d,old.items[2].d/2);
  assert.deepEqual(world(next.items[2],next),world(old.items[2],old));assert.equal(next.options.lighting,'bright');
  assert.deepEqual(next.items[1].screen,{enabled:true,brightness:1});
});
test('A/B preserves independent items, lights, wall state, images and support',()=>{
  const p=createProject(),a=p.layouts.A;
  a.items.push(item('poster',{image:'data:image/png;base64,aGVsbG8=',imageAspect:1.5}));
  const b=switchLayout(p,'B');b.items[0].x=.3;b.options.lighting='dark';b.walls.left=true;b.items[3].w=.8;
  assert.equal(a.items[0].x,0);assert.equal(a.options.lighting,'bright');assert.equal(a.walls.left,false);near(a.items[3].w,.6);
  assert.equal(b.items[1].support,b.items[0].id);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
  assert.equal(switchLayout(p,'A'),a);assert.equal(copyLayout(p),'B');assert.deepEqual(p.layouts.B,a);assert.notEqual(p.layouts.B,a);
});
test('legacy single scene loads into A, invalid project layouts are rejected',()=>{
  const s=initialState();assert.deepEqual(validateProject(s).layouts.A,s);
  const p=createProject();p.active='B';assert.throws(()=>validateProject(p));
  p.active='A';p.layouts.B={};assert.throws(()=>validateProject(p));
});
test('posters stay on all three walls when booth dimensions change',()=>{
  const s=initialState();s.items=[];const poster=item('poster',{x:.1,y:.9});s.items.push(poster);
  near(world(poster,s).z,-.743);assert.deepEqual(issues(s),[]);
  s.discipline='general';near(world(poster,s).z,-.493);
  poster.mount='left';s.booth='team';s.walls.left=true;
  near(world(poster,s).x,-.993);near(world(poster,s).z,-.1);near(world(poster,s).rotation,90);
  setWorld(poster,s,{x:9,z:-.2,y:1.1});near(poster.x,.2);near(poster.y,1.1);near(world(poster,s).x,-.993);
  poster.mount='right';near(world(poster,s).x,.993);near(world(poster,s).z,.2);
  assert.ok(issues(s).some(i=>i.kind==='wall'));s.walls.right=true;
  poster.y=1.5;assert.ok(issues(s).some(i=>i.kind==='boundary'));
  assert.ok(!issues(s).some(i=>i.kind==='floating'));
});
test('throw ratio, distance, aspect and pitch produce consistent screen geometry',()=>{
  const o=item('projector');o.projection.distance=2;o.projection.ratio=1.25;
  let s=projectionShape(o);near(s.width,1.6);near(s.height,.9);near(s.center[2]-s.origin[2],2);
  o.projection.aspect='4:3';o.projection.pitch=30;o.projection.shift=.2;
  s=projectionShape(o);near(s.height,1.2);
  near(s.center[1]-s.origin[1],1+Math.cos(Math.PI/6)*.24);
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  near(distance(s.corners[0],s.corners[1]),1.6);near(distance(s.corners[1],s.corners[2]),1.2);
});
test('invalid image URLs, projection settings and lighting are rejected',()=>{
  for(const change of [o=>o.image='https://example.com/a.jpg',o=>o.mount='ceiling',o=>o.imageAspect=0]) {
    const s=initialState(),o=item('poster');change(o);s.items.push(o);assert.throws(()=>validate(s));
  }
  for(const change of [q=>q.ratio=0,q=>q.distance=Infinity,q=>q.aspect='bad',q=>q.pitch=90,q=>q.brightness=-1]){
    const s=initialState(),o=item('projector');change(o.projection);s.items.push(o);assert.throws(()=>validate(s));
  }
  const s=initialState();s.options.lighting='unknown';assert.throws(()=>validate(s));
});
