import * as THREE from 'three';

// The display front is local +Z. Both the face and its light follow the parent.
export function buildScreen(group,o,dark,allowLight) {
  const {w,h,d}=o,{enabled,brightness}=o.screen;
  const front=d*.085+.002;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w*.925,h*.535),new THREE.MeshStandardMaterial({
    color:enabled?'#b2c9d5':'#101820',roughness:.45,side:THREE.FrontSide,
    emissive:enabled?'#a5d2ff':'#000000',emissiveIntensity:enabled?brightness*(dark?.45:.15):0,
  }));
  face.position.set(0,h*.686,front);group.add(face);
  if(dark&&enabled&&brightness>0&&allowLight) {
    const light=new THREE.SpotLight('#b6dcff',.03*brightness,1.8,Math.PI/3,.85,2);
    light.position.set(0,h*.686,front+.012);light.target.position.set(0,h*.686,front+1);
    light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.01;
    light.shadow.bias=-.00005;light.shadow.normalBias=.001;
    group.add(light,light.target);
  }
}
