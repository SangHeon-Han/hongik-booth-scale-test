import test from 'node:test';
import assert from 'node:assert/strict';
import {BoothScene} from '../src/scene.js';

test('empty space and projector direction guides clear selection without blocking orbit',()=>{
  for(const hits of [[],[{object:{isLine:true,userData:{itemId:'projector'}}}]]){
    let selected='projector';
    const context={state:{items:[]},selected,objects:{children:[]},getRay(){},raycaster:{intersectObjects:()=>hits},callbacks:{select:id=>{selected=id;}}};
    BoothScene.prototype.pointerDown.call(context,{button:0,stopImmediatePropagation(){assert.fail('Orbit controls must receive empty-space clicks');}});
    assert.equal(selected,null);
  }
});

test('projector guide cannot steal a click from a real object behind it',()=>{
  let selected=null;
  const context={state:{items:[{id:'monitor',locked:true}]},objects:{children:[]},getRay(){},raycaster:{intersectObjects:()=>[
    {object:{isLine:true,userData:{itemId:'projector'}}},
    {object:{isMesh:true,userData:{itemId:'monitor'}}}
  ]},callbacks:{select:id=>{selected=id;}}};
  BoothScene.prototype.pointerDown.call(context,{button:0,stopImmediatePropagation(){}});
  assert.equal(selected,'monitor');
});
