export const PRESETS = {
  table: { label: '테이블', subtitle: '상판과 다리', w: 1.2, d: .6, h: .72, color: '#cfb899' },
  imac: { label: 'iMac', subtitle: '일체형 컴퓨터', w: .55, d: .2, h: .46, color: '#bac8c4' },
  monitor: { label: '모니터', subtitle: '받침 켜기 / 끄기', w: .62, d: .22, h: .46, color: '#545e64' },
  tv: { label: 'TV', subtitle: '받침 켜기 / 끄기', w: 1.12, d: .25, h: .72, color: '#42464b' },
  poster: { label: '벽 포스터', subtitle: '이미지 · 벽 부착', w: .6, d: .006, h: .9, color: '#ffffff' },
  projector: { label: '빔프로젝터', subtitle: '본체 · 렌즈 방향', w: .32, d: .25, h: .12, color: '#d8dce0' },
  box: { label: '직육면체', subtitle: '작품 · PC · 받침대', w: .4, d: .4, h: .6, color: '#b3b7c5' },
  human: { label: '사람', subtitle: '키 비교용 픽토그램', w: .663, d: .085, h: 1.7, color: '#42698b' },
};
export const clone = value => structuredClone(value);
export const rad = deg => deg * Math.PI / 180;
export const cm = n => Math.round(n * 1000) / 10;
export const width = state => state.booth === 'team' ? 2 : 1.5;
export const depth = state => state.discipline === 'general' ? 1 : 1.5;
export const humanSize = h => ({ w: h * .39, d: h * .05, h });
export function item(type, overrides = {}) {
  const p = PRESETS[type];
  return { id: crypto.randomUUID(), type, name: p.label, w: p.w, d: p.d, h: p.h, color: p.color,
    x: 0, y: 0, z: 0, rotation: 0, thickness: .035, support: null, locked: false, hidden: false,
    ...(type==='poster'?{mount:'back',image:null,imageAspect:2/3,y:.9}:{}),
    ...(['monitor','tv'].includes(type)?{stand:true}:{}),
    ...(type==='projector'?{projection:{enabled:true,distance:1,ratio:1.2,aspect:'16:9',pitch:0,shift:0,brightness:1,color:'#b6dcff'}}:{}),
    ...(['imac','monitor','tv'].includes(type)?{screen:{enabled:true,brightness:1}}:{}), ...overrides };
}
export function initialState() {
  const table = item('table', { z: -.36 });
  const screen = item('imac', { support: table.id, z: -.02 });
  const human = item('human', { x: .48, z: 1.12, rotation: 180 });
  return { version: 3, name: '부스', booth: 'personal', discipline: 'interaction',
    walls: { back: true, left: false, right: false, thickness: .04, ghost: false },
    options: { grid: true, dimensions: true, snap: .05, rotationSnap: 15, lighting: 'bright', neighbors: false }, items: [table, screen, human] };
}
export function rotate(x, z, degrees) {
  const c = Math.cos(rad(degrees)), s = Math.sin(rad(degrees));
  return { x: c * x + s * z, z: -s * x + c * z };
}
export function world(o, state) {
  if(o.type==='poster') {
    if(o.mount==='left')return {x:-width(state)/2+o.d/2+.004,y:o.y,z:-o.x,rotation:90};
    if(o.mount==='right')return {x:width(state)/2-o.d/2-.004,y:o.y,z:o.x,rotation:-90};
    return {x:o.x,y:o.y,z:-depth(state)/2+o.d/2+.004,rotation:0};
  }
  const parent = state.items.find(p => p.id === o.support && p.type === 'table');
  if (!parent) return { x: o.x, y: o.y, z: o.z, rotation: o.rotation };
  const offset = rotate(o.x, o.z, parent.rotation);
  return { x: parent.x + offset.x, y: parent.y + parent.h, z: parent.z + offset.z, rotation: parent.rotation + o.rotation };
}
export function setWorld(o, state, position) {
  if(o.type==='poster') {
    if(position.y!==undefined)o.y=position.y;
    const axis=o.mount==='back'?'x':'z';
    if(position[axis]!==undefined)o.x=position[axis]*(o.mount==='left'?-1:1);
    return;
  }
  const parent = state.items.find(p => p.id === o.support);
  if (!parent) { Object.assign(o, position); return; }
  const w = { ...world(o, state), ...position };
  const offset = rotate(w.x - parent.x, w.z - parent.z, -parent.rotation);
  o.x = offset.x; o.z = offset.z; o.y = 0; o.rotation = w.rotation - parent.rotation;
}
export function mountPoster(o,state,wall) {
  if(o.type!=='poster'||!['back','left','right'].includes(wall)||o.locked)return;
  if(o.mount!==wall)o.x=0;
  o.mount=wall;state.walls[wall]=true;
}
export function attach(o, state, parentId) {
  const w = world(o, state);
  o.support = parentId || null;
  if (!parentId) Object.assign(o, w);
  else setWorld(o, state, w);
}
export function removeItem(state, id) {
  for (const child of state.items.filter(o => o.support === id)) attach(child, state, null);
  state.items = state.items.filter(o => o.id !== id);
}
export function corners(o, state) {
  const p = world(o, state);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z]) => {
    const q = rotate(x * o.w / 2, z * o.d / 2, p.rotation);
    return { x: p.x + q.x, z: p.z + q.z };
  });
}
export function margins(o, state) {
  const c = corners(o, state);
  return { left: Math.min(...c.map(p => p.x)) + width(state) / 2,
    right: width(state) / 2 - Math.max(...c.map(p => p.x)),
    back: Math.min(...c.map(p => p.z)) + depth(state) / 2,
    front: depth(state) / 2 - Math.max(...c.map(p => p.z)) };
}
function part(o, state, x, y, z, w, h, d) {
  const p = world(o, state), offset = rotate(x, z, p.rotation);
  return { x: p.x + offset.x, z: p.z + offset.z, y: p.y + y, w, h, d, rotation: p.rotation };
}
export function collisionParts(o, state) {
  if (o.type !== 'table') return [part(o,state,0,o.h/2,0,o.w,o.h,o.d)];
  const t = o.thickness, leg = Math.min(.045,o.w*.1,o.d*.1);
  return [part(o,state,0,o.h-t/2,0,o.w,t,o.d),
    ...[-1,1].flatMap(x => [-1,1].map(z => part(o,state,x*(o.w/2-leg), (o.h-t)/2,z*(o.d/2-leg),leg,o.h-t,leg)))];
}
function intersects(a,b) {
  const tolerance = .002;
  if (Math.abs(a.y-b.y) >= (a.h+b.h)/2-tolerance) return false;
  const axes = [a.rotation,a.rotation+90,b.rotation,b.rotation+90].map(v => rotate(1,0,v));
  for (const axis of axes) {
    const project = p => {
      const u=rotate(1,0,p.rotation),v=rotate(0,1,p.rotation);
      return Math.abs(u.x*axis.x+u.z*axis.z)*p.w/2+Math.abs(v.x*axis.x+v.z*axis.z)*p.d/2;
    };
    if (Math.abs((a.x-b.x)*axis.x+(a.z-b.z)*axis.z) >= project(a)+project(b)-tolerance) return false;
  }
  return true;
}
export function issues(state) {
  const found=[];
  for (const o of state.items) {
    const p=world(o,state), m=margins(o,state);
    if (o.type!=='human' && (Math.min(...Object.values(m)) < -.001 || p.y+o.h > 2.001 || p.y < -.001))
      found.push({ ids:[o.id], kind:'boundary', text:`${o.name} · 부스 경계 초과` });
    if(o.type==='poster'&&!state.walls[o.mount])found.push({ids:[o.id],kind:'wall',text:`${o.name} · 부착 벽이 꺼져 있음`});
    if (o.support) {
      const parent=state.items.find(p=>p.id===o.support);
      const local={...o, support:null};
      const pts=corners(local,state);
      if (pts.some(p=>Math.abs(p.x)>parent.w/2+.001 || Math.abs(p.z)>parent.d/2+.001))
        found.push({ids:[o.id],kind:'overhang',text:`${o.name} · 상판 밖 돌출`});
    } else if (p.y>.002 && !['human','poster'].includes(o.type)) found.push({ids:[o.id],kind:'floating',text:`${o.name} · 지지면 없음`});
  }
  const parts=state.items.map(o=>collisionParts(o,state));
  for(let i=0;i<state.items.length;i++) for(let j=i+1;j<state.items.length;j++) {
    if(parts[i].some(a=>parts[j].some(b=>intersects(a,b))))
      found.push({ids:[state.items[i].id,state.items[j].id],kind:'overlap',text:`${state.items[i].name} ↔ ${state.items[j].name} · 겹침 확인`});
  }
  return found;
}
export function validate(raw) {
  const fail=()=>{throw new Error('배치 파일의 형식이나 치수가 올바르지 않습니다.');};
  const finite=(n,min,max)=>typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;
  if(!raw || ![1,2,3].includes(raw.version) || !['personal','team'].includes(raw.booth) || typeof raw.name!=='string' || raw.name.length>80) fail();
  if(raw.version>=2 && !['interaction','general'].includes(raw.discipline)) fail();
  if(!raw.walls || !finite(raw.walls.thickness,.01,.15) || !['back','left','right','ghost'].every(k=>typeof raw.walls[k]==='boolean')) fail();
  if(!raw.options || !['grid','dimensions'].every(k=>typeof raw.options[k]==='boolean') || ![0,.01,.05,.1].includes(raw.options.snap) || ![0,15,45,90].includes(raw.options.rotationSnap)) fail();
  if(raw.version===3&&!['bright','dark'].includes(raw.options.lighting))fail();
  if(raw.options.neighbors!==undefined&&typeof raw.options.neighbors!=='boolean')fail();
  if(!Array.isArray(raw.items) || raw.items.length>100) fail();
  const ids=new Set();
  for(const o of raw.items) {
    if(!o || !Object.hasOwn(PRESETS,o.type) || typeof o.id!=='string' || o.id.length>100 || ids.has(o.id) || typeof o.name!=='string' || o.name.length>80) fail();
    ids.add(o.id);
    if(!['w','d','h'].every(k=>finite(o[k],.001,10)) || !['x','z'].every(k=>finite(o[k],-20,20)) || !finite(o.y,0,10) || !finite(o.rotation,-36000,36000) || !finite(o.thickness,.001,1)) fail();
    if(o.type==='table' && o.thickness>=o.h) fail();
    if(typeof o.color!=='string' || !/^#[a-f0-9]{6}$/i.test(o.color) || typeof o.hidden!=='boolean' || typeof o.locked!=='boolean') fail();
    if(['monitor','tv'].includes(o.type)&&o.stand!==undefined&&typeof o.stand!=='boolean')fail();
    if(raw.version===3) {
      if(o.type==='poster' && (!['back','left','right'].includes(o.mount)||o.support!==null||!finite(o.imageAspect,.01,100)||!(o.image===null||validImage(o.image))))fail();
      if(o.type==='projector') {
        const q=o.projection;
        if(q?.color!==undefined&&(typeof q.color!=='string'||!/^#[a-f0-9]{6}$/i.test(q.color)))fail();
        if(!q||typeof q.enabled!=='boolean'||!finite(q.distance,.1,10)||!finite(q.ratio,.2,4)||!['16:9','4:3','1:1'].includes(q.aspect)||!finite(q.pitch,-60,60)||!finite(q.shift,-1,1)||!finite(q.brightness,0,2))fail();
      }
      if(['imac','monitor','tv'].includes(o.type)&&(!o.screen||typeof o.screen.enabled!=='boolean'||!finite(o.screen.brightness,0,2)))fail();
    }
    if(o.support!==null && typeof o.support!=='string') fail();
  }
  for(const o of raw.items) {
    if(o.support && (['table','human','poster'].includes(o.type) || !raw.items.some(p=>p.id===o.support && p.type==='table' && !p.support))) fail();
    if(o.type==='human' && (Math.abs(o.w-o.h*(raw.version===1?.25:.39))>.0001 || Math.abs(o.d-o.h*(raw.version===1?.16:raw.version===2?.1:.05))>.0001)) fail();
  }
  const next=clone(raw);
  for(const o of next.items)if(['monitor','tv'].includes(o.type))o.stand??=true;
  next.options.neighbors??=false;
  if(next.version<3) {
    if(next.version===1)next.discipline='interaction';
    next.options.lighting='bright';
    for(const o of next.items) {
      if(o.type==='human'){Object.assign(o,humanSize(o.h));if(o.color==='#d6a16b')o.color=PRESETS.human.color;}
      if(o.type==='projector')o.projection={enabled:true,distance:1,ratio:1.2,aspect:'16:9',pitch:0,shift:0,brightness:1,color:'#b6dcff'};
      if(['imac','monitor','tv'].includes(o.type))o.screen={enabled:true,brightness:1};
      if(o.type==='poster')Object.assign(o,{mount:'back',image:null,imageAspect:2/3});
    }
    next.version=3;
  }
  for(const o of next.items)if(o.type==='projector'&&o.projection.color===undefined)o.projection.color='#b6dcff';
  if(next.items.filter(o=>o.type==='poster').length>8)throw new Error('포스터는 배치당 8개까지 사용할 수 있습니다.');
  if(['나의 첫 번째 부스','나의 첫번째 부스'].includes(next.name))next.name='부스';
  return next;
}

export function validImage(value) {return typeof value==='string'&&value.length<=450000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);}
