import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {item,initialState,clone,validate,mountPoster,world,setWorld,issues} from '../src/model.js';
import {displayShape,setDisplayStand} from '../src/display.js';
import {BoothScene} from '../src/scene.js';
import {createProject,switchLayout,validateProject} from '../src/project.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('stand toggles preserve panel size, bottom placement and support; actual mesh loses the feet',()=>{
  for(const type of ['monitor','tv']){
    const o=item(type,{support:'table-id',x:.2,z:.1,rotation:45}),before=clone(o),shape=displayShape(o);
    setDisplayStand(o,false);const next=displayShape(o);
    near(next.height,shape.height);near(next.depth,shape.depth);near(next.faceHeight,shape.faceHeight);
    near(next.centerY-next.height/2,0);assert.equal(o.support,before.support);near(o.x,before.x);near(o.rotation,before.rotation);
    const g=new THREE.Group(),context={dark:false,lightCount:0,mesh:BoothScene.prototype.mesh};
    BoothScene.prototype.buildObject.call(context,g,o);g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g);
    near(bounds.min.y,0);near(bounds.max.y,o.h);near(bounds.max.x-bounds.min.x,o.w);
    // Panel + emissive face + two decorative bars; there is no stem or foot.
    assert.equal(g.children.filter(c=>c.isMesh).length,4);
    setDisplayStand(o,true);near(o.h,before.h);near(o.d,before.d);assert.equal(o.stand,true);
    setDisplayStand(o,true);near(o.h,before.h);
  }
});

test('legacy monitors default to a stand; invalid values are rejected and A/B stays independent',()=>{
  const s=initialState(),m=item('monitor');s.items.push(m);delete m.stand;
  assert.equal(validate(s).items.at(-1).stand,true);assert.equal(m.stand,undefined);
  for(const bad of [0,'false',null]){m.stand=bad;assert.throws(()=>validate(s));}
  const p=createProject();p.layouts.A.items.push(item('tv'));const b=switchLayout(p,'B');
  setDisplayStand(b.items.at(-1),false);
  assert.equal(p.layouts.A.items.at(-1).stand,true);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
});

test('poster mount enables either side, preserves image and height, and supports dragging on that wall',()=>{
  for(const wall of ['left','right','back']){
    const s=initialState();s.items=[];s.walls[wall]=false;
    const p=item('poster',{x:.2,y:1,image:'data:image/png;base64,aGVsbG8='});s.items.push(p);
    mountPoster(p,s,wall);assert.equal(s.walls[wall],true);assert.equal(p.mount,wall);near(p.y,1);
    assert.equal(p.image,'data:image/png;base64,aGVsbG8=');assert.ok(!issues(s).some(i=>i.kind==='wall'));
    const before=world(p,s),normal=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),before.rotation*Math.PI/180);
    assert.ok(normal.dot(new THREE.Vector3(-before.x,0,-before.z))>0);
    setWorld(p,s,wall==='back'?{x:.1,y:.8}:{z:.1,y:.8});const moved=world(p,s);
    near(moved.y,.8);near(wall==='back'?moved.x:moved.z,.1);
    near(wall==='back'?moved.z:moved.x,wall==='back'?before.z:before.x);
    const local=p.x;s.walls[wall]=false;mountPoster(p,s,wall);near(p.x,local);assert.equal(s.walls[wall],true);
    assert.deepEqual(validate(s),s);
  }
});

test('locked posters cannot change mount or enable a wall',()=>{
  const s=initialState(),p=item('poster',{locked:true});const before=clone(p);
  mountPoster(p,s,'left');assert.deepEqual(p,before);assert.equal(s.walls.left,false);
});
