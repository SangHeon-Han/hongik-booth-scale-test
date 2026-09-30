import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { world, width, depth, cm, rad } from './model.js';
import {HALL_FLOOR,neighboringBooths,neighboringWalls} from './environment.js';

import {buildScreen} from './objects/screen.js';
import {buildProjection} from './objects/projection.js';
import { buildHuman } from './objects/human.js';

export class BoothScene {
  constructor(container, callbacks) {
    this.container=container; this.callbacks=callbacks; this.mode='3d'; this.labels=[];this.humanDimensions=[];this.textureCache=new Map();
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color('#eeede8');
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor('#eeede8');
    container.append(this.renderer.domElement);
    this.labelLayer=document.createElement('div'); this.labelLayer.className='scene-labels'; container.append(this.labelLayer);
    this.perspective=new THREE.PerspectiveCamera(37,1,.01,100);
    this.ortho=new THREE.OrthographicCamera(-3,3,3,-3,.01,100);
    this.camera=this.perspective;
    this.raycaster=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    this.renderer.domElement.addEventListener('pointerdown', e=>this.pointerDown(e),true);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true; this.controls.dampingFactor=.09;
    this.controls.minDistance=1; this.controls.maxDistance=30;
    this.controls.maxPolarAngle=Math.PI*.49;
    this.ambient=new THREE.HemisphereLight('#ffffff','#b3aba0',2.5);this.scene.add(this.ambient);
    const light=new THREE.DirectionalLight('#fff5e5',3.3); light.position.set(3,6,4); light.castShadow=true;
    light.shadow.mapSize.set(2048,2048); light.shadow.camera.left=-8; light.shadow.camera.right=8;
    light.shadow.camera.top=8; light.shadow.camera.bottom=-8; light.shadow.normalBias=.015; this.scene.add(light);this.keyLight=light;
    const fill=new THREE.DirectionalLight('#e1eaff',1); fill.position.set(-3,3,-2); this.scene.add(fill);this.fillLight=fill;
    this.effects=new THREE.Group();this.scene.add(this.effects);
    this.root=new THREE.Group(); this.scene.add(this.root);
    this.selectGroup=new THREE.Group(); this.scene.add(this.selectGroup);
    this.objects=new THREE.Group(); this.scene.add(this.objects);
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(container);
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',e=>this.pointerUp(e));
    canvas.addEventListener('pointercancel',e=>this.pointerUp(e,true));
    window.addEventListener('pointerup',e=>this.pointerUp(e));
    window.addEventListener('blur',()=>{if(this.drag){this.callbacks.endDrag(true);this.drag=null;this.controls.enabled=true;canvas.classList.remove('dragging');}});
    this.setView('3d'); this.resize();
    this.renderer.setAnimationLoop(()=>{this.controls.update();this.updateHumanDimensions(this.camera);this.renderer.render(this.scene,this.camera);this.positionLabels();});
  }
  resize() {
    const w=this.container.clientWidth,h=this.container.clientHeight;
    if(!w||!h)return;
    this.renderer.setSize(w,h); this.perspective.aspect=w/h; this.perspective.updateProjectionMatrix();
    const size=Math.max(1.85,1.65*h/w); this.ortho.left=-size*w/h; this.ortho.right=size*w/h; this.ortho.top=size; this.ortho.bottom=-size; this.ortho.updateProjectionMatrix();
    this.setView(this.mode);
  }
  setView(mode) {
    this.mode=mode; this.camera=mode==='3d'?this.perspective:this.ortho;
    this.controls.object=this.camera; this.controls.enableRotate=mode==='3d';
    this.camera.up.set(0,1,0); this.camera.zoom=1;
    const target=new THREE.Vector3(0,.8,.05);
    if(mode==='3d') {const factor=Math.max(1,.95/this.perspective.aspect);this.camera.position.copy(target).add(new THREE.Vector3(3.6,2.3,4.55).multiplyScalar(factor));}
    if(mode==='top') {target.set(0,0,.08);this.camera.position.set(0,7,.08);this.camera.up.set(0,0,-1);}
    if(mode==='front') this.camera.position.set(0,.8,7);
    if(mode==='side') this.camera.position.set(7,.8,.05);
    this.controls.target.copy(target);this.camera.lookAt(target);this.camera.updateProjectionMatrix();this.controls.update();
  }
  focus(o,state) {
    const p=world(o,state),target=new THREE.Vector3(p.x,p.y+o.h/2,p.z);
    const delta=target.clone().sub(this.controls.target); this.camera.position.add(delta);this.controls.target.copy(target);this.controls.update();
  }
  fit() {
    this.setView(this.mode);
    if(!this.state?.options.neighbors)return;
    const booths=neighboringBooths(this.state),extent=Math.max(...booths.map(b=>Math.abs(b.x)+b.w/2))+.5;
    if(this.camera.isPerspectiveCamera){
      const halfFov=this.camera.fov*Math.PI/360;
      const distance=(extent+1)/Math.sin(Math.atan(Math.tan(halfFov)*Math.min(this.camera.aspect,1.6)));
      this.camera.position.sub(this.controls.target).normalize().multiplyScalar(distance).add(this.controls.target);
    }else this.camera.zoom=Math.min(1,(this.camera.right-this.camera.left)/(extent*2.2));
    this.camera.updateProjectionMatrix();this.controls.update();
  }
  disposeGroup(group) {
    group.traverse(o=>{o.geometry?.dispose();if(o.isLight)o.dispose?.();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    group.clear();
  }
  mesh(group,w,h,d,x,y,z,color,options={}) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.78,...options}));
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
  }
  line(group,points,color='#99a49f',dashed=false) {
    const material=dashed?new THREE.LineDashedMaterial({color,dashSize:.035,gapSize:.025}):new THREE.LineBasicMaterial({color});
    if(this.dark){material.transparent=true;material.opacity=dashed?.24:.32;}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),material);
    if(dashed)line.computeLineDistances();group.add(line);return line;
  }
  label(text,point,kind='dimension') {
    const el=document.createElement('span');el.className=`scene-label ${kind}`;el.textContent=text;this.labelLayer.append(el);
    const label={el,point:new THREE.Vector3(...point),text,kind};this.labels.push(label);return label;
  }
  dimension(a,b,text,offsetAxis='z') {
    this.line(this.root,[a,b],'#8c796d');
    const axis=offsetAxis==='z'?2:0;
    for(const p of [a,b]){const u=[...p],v=[...p];u[axis]-=.035;v[axis]+=.035;this.line(this.root,[u,v],'#8c796d');}
    this.label(text,a.map((v,i)=>(v+b[i])/2));
  }
  humanDimension(o,p) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(30),3));
    const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#a76945',depthTest:false}));
    line.renderOrder=10;line.frustumCulled=false;this.root.add(line);
    const label=this.label(`${cm(o.h)} cm`,[p.x,p.y+o.h/2,p.z],'height-label');
    label.el.setAttribute('aria-label',`${o.name} 키 ${cm(o.h)}cm`);
    this.humanDimensions.push({o,p,line,label});
  }
  updateHumanDimensions(camera) {
    camera.updateMatrixWorld();
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);right.y=0;right.normalize();
    const visible=Math.abs(camera.getWorldDirection(new THREE.Vector3()).y)<.98;
    for(const {o,p,line,label} of this.humanDimensions) {
      line.visible=visible;label.suppressed=!visible;
      // Stay on the screen's right even when the person or camera rotates.
      const r=rad(p.rotation),extent=Math.abs(right.x*Math.cos(r)-right.z*Math.sin(r))*o.w/2+Math.abs(right.x*Math.sin(r)+right.z*Math.cos(r))*o.d/2;
      const at=(offset,y)=>new THREE.Vector3(p.x+right.x*offset,p.y+y,p.z+right.z*offset);
      const edge=extent+.025,offset=extent+.16,tick=.035;
      const points=[at(offset,0),at(offset,o.h),at(edge,0),at(offset+tick,0),at(edge,o.h),at(offset+tick,o.h),at(offset-tick,0),at(offset+tick,0),at(offset-tick,o.h),at(offset+tick,o.h)];
      const positions=line.geometry.attributes.position;
      points.forEach((point,i)=>positions.setXYZ(i,point.x,point.y,point.z));positions.needsUpdate=true;
      label.point.copy(at(offset+.065,o.h/2));
    }
  }
  sync(state,selected,issues=[]) {
    this.state=state;this.selected=selected;this.disposeGroup(this.root);this.disposeGroup(this.objects);this.disposeGroup(this.selectGroup);this.disposeGroup(this.effects);
    this.labelLayer.replaceChildren();this.labels=[];this.humanDimensions=[];
    this.dark=state.options.lighting==='dark';this.lightCount=0;
    this.scene.background.set(this.dark?'#161a22':'#eeede8');
    this.ambient.intensity=this.dark?.13:2.5;
    this.keyLight.intensity=this.dark?.16:3.3;this.fillLight.intensity=this.dark?.065:1;
    this.keyLight.color.set(this.dark?'#bec9dc':'#fff5e5');
    this.fillLight.color.set(this.dark?'#a9bce1':'#e1eaff');
    const usedImages=new Set(state.items.filter(o=>o.type==='poster'&&o.image).map(o=>o.image));
    for(const [key,entry] of this.textureCache)if(!usedImages.has(key)){entry.texture.dispose();this.textureCache.delete(key);}
    const w=width(state),d=depth(state),half=d/2,t=state.walls.thickness;
    const f=HALL_FLOOR;
    const ground=this.mesh(this.root,f.w,f.h,f.d,f.x,f.y,f.z,this.dark?'#92949b':'#d9d5cb',{roughness:.92});ground.castShadow=false;
    // Sparse floor joints extend through the aisle, giving the plane depth cues.
    const joints=[];
    for(let n=-20;n<=20;n+=2){joints.push(new THREE.Vector3(n,-.004,-20),new THREE.Vector3(n,-.004,20),new THREE.Vector3(-20,-.004,n),new THREE.Vector3(20,-.004,n));}
    const seams=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(joints),new THREE.LineBasicMaterial({color:this.dark?'#858993':'#938b80',transparent:true,opacity:this.dark?.08:.13,depthWrite:false}));this.root.add(seams);
    if(state.options.neighbors)for(const b of neighboringWalls(state))this.mesh(this.root,b.w,b.h,b.d,b.x,b.y,b.z,'#e5e4df');
    const wallMat={transparent:state.walls.ghost,opacity:state.walls.ghost?.2:1,depthWrite:!state.walls.ghost};
    if(state.walls.back)this.mesh(this.root,w+2*t,2,t,0,1,-half-t/2,'#f8f7f2',wallMat);
    if(state.walls.left)this.mesh(this.root,t,2,d,-w/2-t/2,1,0,'#eeeee8',wallMat);
    if(state.walls.right)this.mesh(this.root,t,2,d,w/2+t/2,1,0,'#eeeee8',wallMat);
    this.line(this.root,[[-w/2,.002,-half],[-w/2,.002,half],[w/2,.002,half],[w/2,.002,-half],[-w/2,.002,-half]],'#8a948c');
    this.line(this.root,[[-w/2,2,-half],[-w/2,2,half],[w/2,2,half],[w/2,2,-half]],'#b4bcb6',true);
    for(const x of [-w/2,w/2]) this.line(this.root,[[x,0,half],[x,2,half]],'#b4bcb6',true);
    if(state.options.grid) {
      for(let x=-w/2;x<=w/2+.001;x+=.1)this.line(this.root,[[x,.002,-half],[x,.002,half]],'#c4c5bb');
      for(let z=-half;z<=half+.001;z+=.1)this.line(this.root,[[-w/2,.002,z],[w/2,.002,z]],'#c4c5bb');
    }
    if(state.options.dimensions) {
      this.dimension([-w/2,.005,half+.27],[w/2,.005,half+.27],`${cm(w)} cm`);
      this.dimension([-w/2-.26,.005,-half],[-w/2-.26,.005,half],`${cm(d)} cm`,'x');
      this.dimension([-w/2-.18,0,-half-.05],[-w/2-.18,2,-half-.05],'200 cm','x');
    }
    this.label('FRONT  /  관람 방향',[0,.005,half+.77],'front-label');
    const flagged=new Set(issues.flatMap(i=>i.ids));
    for(const o of state.items) {
      if(o.hidden||(o.type==='poster'&&!state.walls[o.mount]))continue;
      const g=new THREE.Group(),p=world(o,state);g.userData.itemId=o.id;g.position.set(p.x,p.y,p.z);g.rotation.y=rad(p.rotation);
      if(o.type==='projector') {
        const effect=new THREE.Group();effect.position.copy(g.position);effect.rotation.copy(g.rotation);
        buildProjection(effect,o,this.dark,o.projection.enabled&&o.projection.brightness>0&&this.lightCount++<8);this.effects.add(effect);
      }
      this.buildObject(g,o);g.traverse(c=>c.userData.itemId=o.id);this.objects.add(g);
      if(o.id===selected || flagged.has(o.id)) {
        const helper=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(o.w+.006,o.h+.006,o.d+.006)),new THREE.LineBasicMaterial({color:o.id===selected?'#db6226':'#c17a38'}));
        helper.userData.flagged=flagged.has(o.id);
        helper.position.set(p.x,p.y+o.h/2,p.z);helper.rotation.y=rad(p.rotation);this.selectGroup.add(helper);
      }
      if(state.options.dimensions) {
        if(o.type==='human')this.humanDimension(o,p);
        else if(o.id===selected)this.label(`${o.name} · ${cm(o.w)} × ${cm(o.d)} × ${cm(o.h)} cm`,[p.x,p.y+o.h+.1,p.z],'object-label');
      }
    }
    this.updateHumanDimensions(this.camera);
    this.positionLabels();
  }
  buildObject(g,o) {
    const {w,h,d,color}=o;
    if(o.type==='table') {
      this.mesh(g,w,o.thickness,d,0,h-o.thickness/2,0,color);
      const leg=Math.min(.045,w*.1,d*.1);
      for(const x of [-1,1])for(const z of [-1,1])this.mesh(g,leg,h-o.thickness,leg,x*(w/2-leg),(h-o.thickness)/2,z*(d/2-leg),'#e2ded2');
    } else if(['imac','monitor','tv'].includes(o.type)) {
      this.mesh(g,w,h*.68,d*.17,0,h*.66,0,color);
      buildScreen(g,o,this.dark,o.screen.enabled&&o.screen.brightness>0&&this.lightCount++<8);
      // A quiet graphic distinguishes the display from the bezel without external images.
      this.mesh(g,w*.5,h*.013,.003,-w*.15,h*.58,d*.085+.003,'#9bc1b5');
      this.mesh(g,w*.27,h*.012,.003,-w*.265,h*.55,d*.085+.003,'#718e89');
      this.mesh(g,w*.09,h*.35,d*.11,0,h*.195,-d*.12,color);
      this.mesh(g,w*.34,h*.025,d,0,h*.0125,0,color);
    } else if(o.type==='projector') {
      this.mesh(g,w,h,d,0,h/2,0,color);
      const lens=new THREE.Mesh(new THREE.CylinderGeometry(h*.26,h*.26,.004,32),new THREE.MeshStandardMaterial({color:'#263944',metalness:.4,roughness:.15,emissive:o.projection.enabled?(o.projection.color||'#b6dcff'):'#000000',emissiveIntensity:o.projection.enabled?o.projection.brightness*(this.dark?.8:.2):0}));
      lens.rotation.x=Math.PI/2;lens.position.set(w*.23,h*.53,d/2+.002);g.add(lens);
      for(let i=0;i<5;i++)this.mesh(g,w*.24,h*.035,.002,-w*.2,h*(.3+i*.1),d/2+.001,'#747d7c');
      this.line(g,[[0,.003,d/2+.03],[0,.003,d/2+.18],[-.035,.003,d/2+.13],[0,.003,d/2+.18],[.035,.003,d/2+.13]],'#56776e');
    } else if(o.type==='poster') {
      this.mesh(g,w,h,d,0,h/2,0,o.color);
      if(o.image){const texture=this.posterTexture(o.image);const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.9}));face.position.set(0,h/2,d/2+.0005);g.add(face);}
    } else if(o.type==='human') {
      buildHuman(g,o);
    } else this.mesh(g,w,h,d,0,h/2,0,color);
  }
  posterTexture(data) {
    if(this.textureCache.has(data))return this.textureCache.get(data).texture;
    const texture=new THREE.Texture();texture.colorSpace=THREE.SRGBColorSpace;
    const img=new Image();const entry={texture,ready:null};
    entry.ready=new Promise(resolve=>{img.onload=()=>{texture.image=img;texture.needsUpdate=true;resolve();};img.onerror=()=>resolve();});
    this.textureCache.set(data,entry);img.src=data;return texture;
  }
  readyImages(){return Promise.all([...this.textureCache.values()].map(entry=>entry.ready));}
  positionLabels() {
    const w=this.container.clientWidth,h=this.container.clientHeight;
    const placed=[];
    for(const label of this.labels) {
      const p=label.point.clone().project(this.camera);label.px=(p.x*.5+.5)*w;label.py=(-p.y*.5+.5)*h;
      const visible=!label.suppressed&&p.z>-1&&p.z<1&&label.px>0&&label.px<w&&label.py>0&&label.py<h;
      const span=label.text.length*5.8+16;
      if(label.kind==='height-label')label.px+=span/2;
      for(let i=0;label.kind!=='height-label'&&i<6&&placed.some(b=>Math.abs(label.px-b.x)<(span+b.w)/2&&Math.abs(label.py-b.y)<25);i++)label.py-=26;
      if(visible)placed.push({x:label.px,y:label.py,w:span});
      label.el.hidden=!visible;label.el.style.left=`${label.px}px`;label.el.style.top=`${label.py}px`;
    }
  }
  getRay(e) {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);return this.raycaster.ray;
  }
  pointerDown(e) {
    if(e.button!==0 || !this.state)return;
    // Direction guides are not selectable surfaces (Line raycasts have a wide tolerance).
    this.getRay(e);const hit=this.raycaster.intersectObjects(this.objects.children,true).find(hit=>hit.object.isMesh);
    if(!hit){if(this.selected)this.callbacks.select(null);return;}
    const id=hit.object.userData.itemId,o=this.state.items.find(o=>o.id===id);
    e.stopImmediatePropagation();this.callbacks.select(id);
    if(o.locked)return;
    const p=world(o,this.state);
    const normal=o.type==='poster'?(o.mount==='back'?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0)):this.mode==='front'?new THREE.Vector3(0,0,1):this.mode==='side'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point);
    this.drag={id,start:hit.point.clone(),position:p,plane,moved:false,client:[e.clientX,e.clientY]};
    this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);this.callbacks.startDrag();
    this.renderer.domElement.classList.add('dragging');
  }
  pointerMove(e) {
    if(!this.drag)return;
    if((e.buttons&1)===0){this.pointerUp(e);return;}
    if(Math.hypot(e.clientX-this.drag.client[0],e.clientY-this.drag.client[1])<3&&!this.drag.moved)return;
    const p=this.getRay(e).intersectPlane(this.drag.plane,new THREE.Vector3());if(!p)return;
    this.drag.moved=true;const d=p.sub(this.drag.start),base=this.drag.position,s=this.state.options.snap;
    const snap=n=>s?Math.round(n/s)*s:n;
    const y=this.state.items.find(o=>o.id===this.drag.id)?.type==='poster'||this.mode==='front'||this.mode==='side'?Math.max(0,snap(base.y+d.y)):base.y;
    this.callbacks.move(this.drag.id,{x:Math.max(-20,Math.min(20,snap(base.x+d.x))),y:Math.min(10,y),z:Math.max(-20,Math.min(20,snap(base.z+d.z)))});
  }
  pointerUp(e,cancel=false) {
    if(!this.drag)return;
    this.callbacks.endDrag(cancel);this.drag=null;this.controls.enabled=true;this.renderer.domElement.classList.remove('dragging');
    if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);
  }
  exportImage(title,subtitle) {
    const renderWidth=1600,renderHeight=1000,header=90,footer=44;
    const camera=this.camera.clone();
    if(camera.isPerspectiveCamera){
      camera.aspect=renderWidth/renderHeight;
      camera.position.copy(this.controls.target).add(this.camera.position.clone().sub(this.controls.target).multiplyScalar(Math.min(1,this.perspective.aspect/.95)));
    }else {camera.left=-1.85*renderWidth/renderHeight;camera.right=1.85*renderWidth/renderHeight;camera.top=1.85;camera.bottom=-1.85;}
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const oldRatio=this.renderer.getPixelRatio(),oldSize=this.renderer.getSize(new THREE.Vector2());
    for(const helper of this.selectGroup.children) {helper.userData.exportColor=helper.material.color.clone();helper.visible=helper.userData.flagged;if(helper.visible)helper.material.color.set('#c17a38');}
    this.updateHumanDimensions(camera);
    this.renderer.setPixelRatio(1);this.renderer.setSize(renderWidth,renderHeight,false);this.renderer.render(this.scene,camera);
    const canvas=document.createElement('canvas'),source=this.renderer.domElement;
    canvas.width=renderWidth;canvas.height=renderHeight+header+footer;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eeede8';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source,0,header);
    ctx.fillStyle='#44352c';ctx.font='600 25px "Malgun Gothic", sans-serif';ctx.fillText(title,42,41,renderWidth-84);
    ctx.font='15px "Malgun Gothic", sans-serif';ctx.fillText(subtitle,42,69,renderWidth-84);
    const placed=[];
    for(const l of this.labels) {
      const point=l.point.clone().project(camera);if(l.suppressed||point.z<-1||point.z>1)continue;
      ctx.font='16px "Malgun Gothic", sans-serif';const labelWidth=ctx.measureText(l.text).width+24;
      const x=Math.max(labelWidth/2+8,Math.min(renderWidth-labelWidth/2-8,(point.x*.5+.5)*renderWidth+(l.kind==='height-label'?labelWidth/2:0)));
      let y=Math.max(header+20,Math.min(canvas.height-footer-20,(-point.y*.5+.5)*renderHeight+header));
      for(let i=0;l.kind!=='height-label'&&i<6&&placed.some(b=>Math.abs(x-b.x)<(labelWidth+b.w)/2&&Math.abs(y-b.y)<34);i++)y-=36;
      placed.push({x,y,w:labelWidth});
      ctx.fillStyle='#f8f8f3';ctx.fillRect(x-labelWidth/2,y-16,labelWidth,32);ctx.fillStyle='#60432f';ctx.textAlign='center';ctx.fillText(l.text,x,y+6);
    }
    ctx.textAlign='left';ctx.font='14px "Malgun Gothic", sans-serif';ctx.fillStyle='#75675d';
    ctx.fillText('치수: cm  ·  주황 외곽: 검토 필요  ·  실제 비례 모델 / 화면의 실물 1:1 크기는 아님',42,canvas.height-20,renderWidth-84);
    for(const helper of this.selectGroup.children){helper.visible=true;helper.material.color.copy(helper.userData.exportColor);}
    this.renderer.setPixelRatio(oldRatio);this.renderer.setSize(oldSize.x,oldSize.y,false);
    this.updateHumanDimensions(this.camera);this.renderer.render(this.scene,this.camera);return canvas;
  }
}
