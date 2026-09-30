import * as THREE from 'three';
import {projectionShape} from '../projection.js';

export function buildProjection(group,o,dark,allowLight) {
  const q=o.projection;if(!q.enabled)return;
  const color=q.color||'#b6dcff';
  const shape=projectionShape(o),points=shape.corners.map(p=>new THREE.Vector3(...p));
  const origin=new THREE.Vector3(...shape.origin),center=new THREE.Vector3(...shape.center);
  const vertices=[];
  for(let i=0;i<4;i++)vertices.push(...origin.toArray(),...points[i].toArray(),...points[(i+1)%4].toArray());
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const cone=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:(dark?.035:.018)*q.brightness,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  group.add(cone);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(shape.width,shape.height),new THREE.MeshBasicMaterial({color,transparent:true,opacity:(dark?.5:.23)*Math.min(1,q.brightness),side:THREE.DoubleSide,depthWrite:false}));
  plane.position.copy(center);plane.rotation.x=-q.pitch*Math.PI/180;group.add(plane);
  const edges=[];
  for(let i=0;i<4;i++)edges.push(points[i],points[(i+1)%4]);
  const right=new THREE.Vector3(1,0,0),up=new THREE.Vector3(...shape.up);
  for(const v of [-.25,0,.25]) {
    edges.push(center.clone().addScaledVector(right,v*shape.width).addScaledVector(up,-shape.height/2),center.clone().addScaledVector(right,v*shape.width).addScaledVector(up,shape.height/2));
    edges.push(center.clone().addScaledVector(up,v*shape.height).addScaledVector(right,-shape.width/2),center.clone().addScaledVector(up,v*shape.height).addScaledVector(right,shape.width/2));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges),new THREE.LineBasicMaterial({color,transparent:true,opacity:.4})));
  if(dark&&q.brightness>0&&allowLight) {
    const light=new THREE.SpotLight(color,.06*q.brightness,1,Math.PI/3,.9,2);
    light.position.copy(center).addScaledVector(new THREE.Vector3(...shape.forward),-.13);
    light.target.position.copy(center);group.add(light,light.target);
  }
}
