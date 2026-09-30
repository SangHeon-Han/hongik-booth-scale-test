import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildHuman } from '../src/objects/human.js';
import { humanSize } from '../src/model.js';

test('pictogram has exact height and footprint at different heights',()=>{
  for(const h of [1.5,1.7,1.8]) {
    const group=new THREE.Group(),size=humanSize(h);buildHuman(group,{...size,color:'#42698b'});
    const box=new THREE.Box3().setFromObject(group),actual=box.getSize(new THREE.Vector3());
    for(const [a,b] of [[actual.x,size.w],[actual.y,h],[actual.z,size.d],[box.min.y,0]])assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
    // The head must be separated, while arms and legs form one connected body.
    assert.equal(group.children.length,2);
    const body=new THREE.Box3().setFromObject(group.children[0]),head=new THREE.Box3().setFromObject(group.children[1]);
    assert.ok(head.min.y>body.max.y);
    // Test the actual front silhouette: solid torso, clear armpits and leg gap.
    const ray=new THREE.Raycaster();
    const hit=(x,y)=>{ray.set(new THREE.Vector3(x*h,y*h,1),new THREE.Vector3(0,0,-1));return ray.intersectObjects(group.children).length>0;};
    assert.equal(hit(0,.6),true);assert.equal(hit(.115,.6),false);
    assert.equal(hit(.16,.6),true);assert.equal(hit(0,.25),false);assert.equal(hit(.06,.25),true);
    group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
});
