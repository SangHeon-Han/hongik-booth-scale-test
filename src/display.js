export const canToggleStand=o=>['monitor','tv'].includes(o.type);
export const hasStand=o=>!canToggleStand(o)||o.stand!==false;

// Preserve the panel's size when adding/removing the stand. Dimensions always
// describe the current exterior; the bottom stays on its placement surface.
export function setDisplayStand(o,enabled) {
  if(!canToggleStand(o)||typeof enabled!=='boolean'||hasStand(o)===enabled)return;
  const h=enabled?o.h/.68:o.h*.68,d=enabled?o.d/.17:o.d*.17;
  if(h<.001||d<.001||h>10||d>10)throw new Error('받침 변경 후 치수가 허용 범위를 벗어납니다. 높이와 깊이를 조절해주세요.');
  o.h=h;o.d=d;o.stand=enabled;
}

export function displayShape(o) {
  const stand=hasStand(o),height=stand?o.h*.68:o.h,depth=stand?o.d*.17:o.d;
  const centerY=stand?o.h*.66:o.h/2;
  return {stand,height,depth,centerY,faceHeight:height*.535/.68,faceY:centerY+height*.026/.68,front:depth/2+.002};
}
