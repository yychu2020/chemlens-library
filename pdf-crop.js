import {validBox} from './figure-geometry.js';
export const PDF_CROP_VERSION=1;
export function planPDFCrop(base,box,{longEdge=2400,shortEdge=900,maxPixels=8000000,maxScale=48,maxEdge=8192}={}){
 if(!validBox(box)||!Number.isFinite(base?.width)||!Number.isFinite(base?.height)||base.width<=0||base.height<=0)throw Error('PDF选区无效。');
 const w=base.width*box.width,h=base.height*box.height;
 const scale=Math.min(Math.max(300/72,longEdge/Math.max(w,h),shortEdge/Math.min(w,h)),maxScale,Math.sqrt(maxPixels/(w*h)),maxEdge/w,maxEdge/h);
 return {scale,width:Math.max(1,Math.floor(w*scale)),height:Math.max(1,Math.floor(h*scale)),offsetX:base.width*box.x*scale,offsetY:base.height*box.y*scale};
}
// Render PDF operators directly into a clipped high-resolution canvas. Never
// enlarge a crop taken from the low-resolution reading/preview canvas.
export async function renderPDFCrop(doc,pageNumber,box,{canvasFactory=()=>document.createElement('canvas'),...options}={}){
 const page=await doc.getPage(pageNumber),base=page.getViewport({scale:1}),plan=planPDFCrop(base,box,options),canvas=canvasFactory();
 canvas.width=plan.width;canvas.height=plan.height;
 try{await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:plan.scale}),transform:[1,0,0,1,-plan.offsetX,-plan.offsetY],background:'#ffffff'}).promise;return {image:canvas.toDataURL('image/jpeg',.96),imageWidth:plan.width,imageHeight:plan.height,imageRenderVersion:PDF_CROP_VERSION};}finally{canvas.width=canvas.height=0;}
}
