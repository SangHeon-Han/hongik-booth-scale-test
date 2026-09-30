import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {item,initialState,validate} from '../src/model.js';
import {createProject,validateProject,switchLayout} from '../src/project.js';
import {buildScreen} from '../src/objects/screen.js';
import {buildProjection} from '../src/objects/projection.js';

test('screen emission and light face forward after device and support rotation',()=>{
  for(const rotation of [0,Math.PI/2,Math.PI]){
    const support=new THREE.Group(),group=new THREE.Group();support.rotation.y=.4;
    group.rotation.y=rotation;support.add(group);buildScreen(group,item('monitor'),true,true);
    support.updateMatrixWorld(true);
    const face=group.children.find(o=>o.isMesh),light=group.children.find(o=>o.isLight);
    assert.equal(face.material.side,THREE.FrontSide);assert.equal(light.type,'SpotLight');
    assert.ok(light.castShadow);assert.ok(light.position.z>face.position.z);
    const direction=light.target.getWorldPosition(new THREE.Vector3()).sub(light.getWorldPosition(new THREE.Vector3())).normalize();
    const front=new THREE.Vector3(0,0,1).transformDirection(group.matrixWorld);
    assert.ok(direction.dot(front)>.99999);
    assert.ok(light.angle<Math.PI/2);assert.ok(light.intensity<.07);
  }
});

test('disabled screens, zero brightness and bright rooms produce no screen light',()=>{
  for(const [dark,enabled,brightness] of [[false,true,1],[true,false,1],[true,true,0]]){
    const group=new THREE.Group(),o=item('tv');o.screen={enabled,brightness};
    buildScreen(group,o,dark,true);assert.ok(!group.children.some(o=>o.isLight));
    if(!enabled||!brightness)assert.equal(group.children[0].material.emissiveIntensity,0);
  }
});

test('projector color reaches the beam, screen, guide and light',()=>{
  const group=new THREE.Group(),o=item('projector');o.projection.color='#ff7744';
  buildProjection(group,o,true,true);
  for(const child of group.children){
    if(child.material)assert.equal(child.material.color.getHexString(),'ff7744');
    if(child.isLight)assert.equal(child.color.getHexString(),'ff7744');
  }
});

test('projector colors survive independent A/B save and load; older files get the default',()=>{
  const p=createProject();p.layouts.A.items.push(item('projector'));
  const b=switchLayout(p,'B');b.items.at(-1).projection.color='#ee6622';
  const loaded=validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(loaded.layouts.A.items.at(-1).projection.color,'#b6dcff');
  assert.equal(loaded.layouts.B.items.at(-1).projection.color,'#ee6622');
  delete p.layouts.A.items.at(-1).projection.color;
  assert.equal(validateProject(p).layouts.A.items.at(-1).projection.color,'#b6dcff');
  assert.equal(p.layouts.A.items.at(-1).projection.color,undefined);
  for(const color of ['red','#fff','<script>',null,42]){
    const s=initialState(),o=item('projector');o.projection.color=color;s.items.push(o);
    assert.throws(()=>validate(s));
  }
});
