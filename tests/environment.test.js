import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validate,width,depth,issues,clone} from '../src/model.js';
import {createProject,switchLayout,validateProject} from '../src/project.js';
import {neighboringBooths,neighboringWalls,HALL_FLOOR} from '../src/environment.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('neighbor booths keep 150 cm clear dimensions and share partitions for every main booth size',()=>{
  for(const booth of ['personal','team'])for(const discipline of ['interaction','general'])for(const thickness of [.01,.04,.15]){
    const s=initialState();s.booth=booth;s.discipline=discipline;s.walls.thickness=thickness;
    const before=clone(s),neighbors=neighboringBooths(s),walls=neighboringWalls(s);
    assert.equal(neighbors.length,6);assert.equal(walls.length,12);assert.deepEqual(s,before);
    for(const b of neighbors){
      assert.equal(b.w,1.5);assert.equal(b.d,1.5);assert.equal(b.h,2);
      near(b.z-b.d/2,-depth(s)/2);
      assert.ok(Math.abs(b.x)-b.w/2>=width(s)/2+thickness-1e-8);
      assert.ok(Math.abs(b.x)+b.w/2<HALL_FLOOR.w/2);
    }
    for(const side of [-1,1]){
      const row=neighbors.filter(b=>b.side===side);
      near(Math.abs(row[0].x)-.75,width(s)/2+thickness);
      near(Math.abs(row[1].x-row[0].x)-1.5,thickness);
    }
    near(HALL_FLOOR.y+HALL_FLOOR.h/2,-.005);
  }
});

test('context toggle survives A/B and JSON without altering editable items or checks',()=>{
  const p=createProject(),a=p.layouts.A,b=switchLayout(p,'B');
  const before=clone(b.items),checks=issues(b);b.options.neighbors=true;
  assert.equal(a.options.neighbors,false);assert.deepEqual(b.items,before);assert.deepEqual(issues(b),checks);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
});

test('older files default to no neighboring booths and invalid settings are rejected',()=>{
  const s=initialState();delete s.options.neighbors;
  assert.equal(validate(s).options.neighbors,false);assert.equal(s.options.neighbors,undefined);
  for(const value of ['true',1,null,{}]){s.options.neighbors=value;assert.throws(()=>validate(s));}
});
