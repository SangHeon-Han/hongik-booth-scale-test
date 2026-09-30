import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,item,width,depth,humanSize,world,setWorld,attach,removeItem,issues,validate,clone,margins} from '../src/model.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('initial dimensions, wall thickness, and demonstration are valid',()=>{
  const s=initialState();assert.equal(width(s),1.5);assert.equal(s.walls.thickness,.04);
  assert.deepEqual(issues(s),[]);assert.deepEqual(validate(s),s);
  near(world(s.items[1],s).y,.72);
});
test('switching booth retains all item properties and flags excess width',()=>{
  const s=initialState();s.items=[item('box',{w:.4,x:.72})];s.booth='team';
  const before=clone(s.items);assert.equal(width(s),2);assert.equal(issues(s).length,0);
  s.booth='personal';assert.deepEqual(s.items,before);assert.equal(issues(s)[0].kind,'boundary');
});
test('rotated bounds use rotated corners',()=>{
  const s=initialState();s.items=[item('box',{w:1.2,d:1.2,h:.5,rotation:0})];
  assert.equal(issues(s).length,0);s.items[0].rotation=45;
  assert.equal(issues(s)[0].kind,'boundary');assert.ok(margins(s.items[0],s).left<0);
});
test('supported device follows table position, rotation, and height',()=>{
  const s=initialState(),[t,m]=s.items;t.x=.2;t.z=-.1;t.rotation=90;t.h=.8;m.x=.1;m.z=.2;m.rotation=30;
  const p=world(m,s);near(p.x,.4);near(p.z,-.2);near(p.y,.8);near(p.rotation,120);
});
test('world coordinate edits are transformed to support relative coordinates',()=>{
  const s=initialState(),[t,m]=s.items;t.rotation=45;
  setWorld(m,s,{x:.2,z:-.15,rotation:60});const p=world(m,s);
  near(p.x,.2);near(p.z,-.15);near(p.rotation,60);near(p.y,.72);
});
test('detaching and deleting tables preserve equipment world pose',()=>{
  const s=initialState(),[t,m]=s.items;t.rotation=90;
  const p=world(m,s);removeItem(s,t.id);assert.equal(m.support,null);assert.deepEqual(world(m,s),p);
  assert.ok(issues(s).some(i=>i.kind==='floating'));
});
test('table attachment preserves horizontal pose and aligns base to tabletop',()=>{
  const s=initialState(),t=s.items[0],m=item('monitor',{x:.1,z:-.3});s.items.push(m);
  attach(m,s,t.id);near(world(m,s).x,.1);near(world(m,s).z,-.3);near(world(m,s).y,.72);
  attach(m,s,null);near(m.y,.72);
});
test('normal tabletop contact does not generate overlap',()=>{
  const s=initialState();s.items=s.items.slice(0,2);assert.deepEqual(issues(s),[]);
});
test('empty space below table is not a collision',()=>{
  const s=initialState();s.items=[item('table'),item('box',{w:.2,d:.2,h:.4})];
  assert.ok(!issues(s).some(i=>i.kind==='overlap'));
  s.items[1].h=.8;assert.ok(issues(s).some(i=>i.kind==='overlap'));
});
test('rotated overlap uses separating axes rather than axis aligned bounds',()=>{
  const s=initialState();s.items=[item('box',{w:1,d:.1,h:.1,rotation:45}),item('box',{w:1,d:.1,h:.1,rotation:45,z:.2})];
  assert.ok(!issues(s).some(i=>i.kind==='overlap'));
  s.items[1].z=.05;assert.ok(issues(s).some(i=>i.kind==='overlap'));
});
test('overhanging screen flagged independently of booth boundary',()=>{
  const s=initialState();s.items[1].x=.5;
  assert.ok(issues(s).some(i=>i.kind==='overhang'));
});
test('external people excluded from booth boundary, hidden items still checked',()=>{
  const s=initialState();s.items=[item('human',{x:3}),item('box',{x:2,hidden:true})];
  const found=issues(s);assert.equal(found.length,1);assert.deepEqual(found[0].ids,[s.items[1].id]);
});
test('JSON roundtrip preserves pose, support and options',()=>{
  const s=initialState();s.booth='team';s.walls.left=true;s.items[0].rotation=37;
  assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);
});
test('invalid scene versions, dimensions, wall settings, IDs and links are rejected',()=>{
  const mutations=[s=>s.version=9,s=>s.items[0].w=0,s=>s.items[0].x=Infinity,s=>s.walls.thickness=0,
    s=>s.items[1].support='missing',s=>s.items[1].id=s.items[0].id,s=>s.items[0].thickness=1,
    s=>s.items[0].color='red',s=>s.items[0].support=s.items[1].id,s=>s.items[2].w=1,
    s=>s.items[0].type='toString',s=>s.options.snap=.3];
  for(const mutate of mutations){const s=initialState();mutate(s);assert.throws(()=>validate(s));}
});

test('all four booth combinations retain objects and use the correct boundaries',()=>{
  const s=initialState();s.items=[item('box',{w:.2,d:.2,z:.55})];
  const before=clone(s.items);
  for(const booth of ['personal','team'])for(const discipline of ['interaction','general']) {
    s.booth=booth;s.discipline=discipline;
    assert.equal(width(s),booth==='team'?2:1.5);
    assert.equal(depth(s),discipline==='general'?1:1.5);
    near(margins(s.items[0],s).front,discipline==='general'?-.15:.1);
    assert.equal(issues(s).some(i=>i.kind==='boundary'),discipline==='general');
    assert.deepEqual(s.items,before);assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);
  }
});
test('v1 migration preserves saved poses, custom names and support relationships',()=>{
  const old=initialState();old.version=1;delete old.discipline;old.name='내 전시 A안';
  const human=old.items[2];human.w=human.h*.25;human.d=human.h*.16;human.color='#123456';
  old.items[0].rotation=35;
  const snapshot=clone(old),next=validate(old);
  assert.deepEqual(old,snapshot);assert.equal(next.version,3);assert.equal(next.discipline,'interaction');
  assert.equal(next.name,old.name);assert.deepEqual(next.items.slice(0,2),old.items.slice(0,2));
  assert.deepEqual(next.items[2],{...human,...humanSize(human.h)});
  old.name='나의 첫 번째 부스';human.color='#d6a16b';
  assert.equal(validate(old).name,'부스');assert.equal(validate(old).items[2].color,'#42698b');
});
test('v2 requires a known discipline and roundtrips resized people',()=>{
  const s=initialState();delete s.discipline;assert.throws(()=>validate(s));
  s.discipline='unknown';assert.throws(()=>validate(s));s.discipline='general';
  Object.assign(s.items[2],humanSize(1.8));assert.deepEqual(validate(s),s);
});
