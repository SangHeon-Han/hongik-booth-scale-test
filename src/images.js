// Keep uploaded art inside the JSON. No remote image requests or file paths.
export async function readPosterImage(file) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10_000_000)throw new Error('10MB 이하의 PNG, JPG, WebP 이미지를 선택하세요.');
  const bitmap=await createImageBitmap(file);
  try {
    const aspect=bitmap.width/bitmap.height;
    if(aspect<.01||aspect>100)throw new Error('이미지 비율이 너무 큽니다.');
    const canvas=document.createElement('canvas');let scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
    for(let attempt=0;attempt<5;attempt++) {
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const image=canvas.toDataURL('image/jpeg',.84);
      if(image.length<=450000)return {image,imageAspect:aspect};
      scale*=.7;
    }
    throw new Error('이미지를 압축하지 못했습니다. 더 작은 이미지를 선택하세요.');
  } finally {bitmap.close();}
}
