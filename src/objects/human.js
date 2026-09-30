import * as THREE from 'three';

// Front-facing pictogram in XY, extruded along Z. Height is exactly 0…h.
export function buildHuman(group, { w, h, d, color }) {
  const body = new THREE.Shape();
  body.moveTo(-.085,.815);
  body.bezierCurveTo(-.146,.815,-.195,.771,-.195,.709);
  body.lineTo(-.195,.455);
  body.bezierCurveTo(-.195,.407,-.124,.407,-.124,.455);
  body.lineTo(-.124,.685);body.lineTo(-.107,.685);
  body.lineTo(-.107,.05);
  body.bezierCurveTo(-.107,-.0166666666666667,-.012,-.0166666666666667,-.012,.05);
  body.lineTo(-.012,.418);body.lineTo(.012,.418);
  body.lineTo(.012,.05);
  body.bezierCurveTo(.012,-.0166666666666667,.107,-.0166666666666667,.107,.05);
  body.lineTo(.107,.685);body.lineTo(.124,.685);
  body.lineTo(.124,.455);
  body.bezierCurveTo(.124,.407,.195,.407,.195,.455);
  body.lineTo(.195,.709);
  body.bezierCurveTo(.195,.771,.146,.815,.085,.815);
  body.closePath();
  const head = new THREE.Shape();
  head.absarc(0,.918,.082,0,Math.PI*2,false);
  // The two silhouettes share a material but have separate disposable instances.
  for(const shape of [body,head]) {
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,curveSegments:24,steps:1});
    geometry.scale(w/.39,h,1);geometry.translate(0,0,-d/2);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.85}));
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
}
