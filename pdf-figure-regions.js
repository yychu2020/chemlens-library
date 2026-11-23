import {captionAnchors,figureKey,validBox} from './figure-geometry.js';
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function rect(matrix,b,viewport){const pts=[[b[0],b[1]],[b[0],b[3]],[b[2],b[1]],[b[2],b[3]]].map(([x,y])=>point(matrix,x,y)).map(([x,y])=>viewport.convertToViewportPoint(x,y)),xs=pts.map(p=>p[0]/viewport.width),ys=pts.map(p=>p[1]/viewport.height);return{x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};}
export function graphicsFromOperators(list,viewport,ops){
 const result=[],stack=[],paint=new Set(['stroke','closeStroke','fill','eoFill','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke'].map(k=>ops[k]));let matrix=[1,0,0,1,0,0],pending=null;
 const add=(b,image=false,m=matrix)=>{if(!b||b.length!==4||!Array.from(b).every(Number.isFinite))return;const r=rect(m,b,viewport);if(!Object.values(r).every(Number.isFinite)||r.right<0||r.x>1||r.bottom<0||r.y>1)return;r.x=Math.max(0,r.x);r.y=Math.max(0,r.y);r.right=Math.min(1,r.right);r.bottom=Math.min(1,r.bottom);if((r.right-r.x)*(r.bottom-r.y)>.85)return;result.push({...r,image});};
 for(let i=0;i<list.fnArray.length;i++){const fn=list.fnArray[i],a=list.argsArray[i]||[];
  if(fn===ops.save){stack.push([...matrix]);continue;}if(fn===ops.restore){matrix=stack.pop()||[1,0,0,1,0,0];continue;}if(fn===ops.transform){matrix=mul(matrix,a);continue;}
  if(fn===ops.paintFormXObjectBegin){stack.push([...matrix]);if(a[0]?.length===6)matrix=mul(matrix,a[0]);continue;}if(fn===ops.paintFormXObjectEnd){matrix=stack.pop()||[1,0,0,1,0,0];continue;}
  if(fn===ops.constructPath){const bounds=a[2];if(typeof a[0]==='number'){if(paint.has(a[0]))add(bounds);}else pending=bounds;continue;}
  if(paint.has(fn)&&pending){add(pending);pending=null;continue;}if(fn===ops.endPath){pending=null;continue;}
  if([ops.paintImageXObject,ops.paintInlineImageXObject,ops.paintImageMaskXObject,ops.paintSolidColorImageMask].includes(fn))add([0,0,1,1],true);
  if(fn===ops.paintImageXObjectRepeat){const positions=a[3]||[];for(let j=0;j<positions.length;j+=2)add([0,0,1,1],true,mul(matrix,[a[1],0,0,a[2],positions[j],positions[j+1]]));}
 }
 return result;
}
function textRects(content,viewport){return(content.items||[]).filter(i=>i.str?.trim()&&i.transform).map(i=>{const p=viewport.convertToViewportPoint(i.transform[4],i.transform[5]),h=Math.max(2,Math.abs(i.height||i.transform[3]||8)*viewport.scale);return{text:i.str,x:p[0]/viewport.width,y:(p[1]-h)/viewport.height,right:(p[0]+Math.abs(i.width||0)*viewport.scale)/viewport.width,bottom:p[1]/viewport.height,h:h/viewport.height};});}
function proseMasks(items){const rows=[];for(const t of items){const col=t.x<.5?0:1;let r=rows.find(r=>r.col===col&&Math.abs(r.bottom-t.bottom)<.003);if(!r){r={...t,col};rows.push(r);}else{r.text+=' '+t.text;r.x=Math.min(r.x,t.x);r.right=Math.max(r.right,t.right);r.y=Math.min(r.y,t.y);r.bottom=Math.max(r.bottom,t.bottom);}}
 const masks=[];for(const col of [0,1]){const lines=rows.filter(r=>r.col===col).sort((a,b)=>a.y-b.y);let group=[];const flush=()=>{if(group.length>=4){const first=group[0],last=group.at(-1),prev=lines[lines.indexOf(first)-1],includePrev=prev&&first.y-prev.bottom<.02&&prev.h>=first.h*.95&&!/^Fig(?:ure)?\.?\s*\d/.test(first.text);masks.push({x:Math.min(...group.map(r=>r.x))-.003,right:Math.max(...group.map(r=>r.right))+.003,y:includePrev?prev.y:first.y,bottom:last.bottom+.004});}group=[];};for(const line of lines){const prose=(line.text.match(/[A-Za-z]{3,}/g)||[]).length>=5||(line.text.match(/[\u3400-\u9fff]/g)||[]).length>=20;if(prose&&(!group.length||line.y-group.at(-1).bottom<.02))group.push(line);else{flush();if(prose)group=[line];}}flush();}return masks;
}
export function regionsForPage(content,viewport,graphics,anchors,page){
 const captions=anchors.filter(a=>a.page===page).sort((a,b)=>a.bbox.y-b.bbox.y),texts=textRects(content,viewport),masks=proseMasks(texts),regions=[];
 for(const anchor of captions){
  // Side-by-side independent figures need lateral assignment. Leave those to
  // visual verification instead of returning a confident union of both figures.
  if(captions.some(a=>a!==anchor&&Math.abs(a.bbox.y-anchor.bbox.y)<.035&&figureKey(a.number)!==figureKey(anchor.number)))continue;
  const previous=captions.filter(a=>a.bbox.y<anchor.bbox.y).at(-1),top=previous?previous.bbox.y+previous.bbox.height+.006:.045,bottom=anchor.bbox.y-.004;
  const shapes=graphics.filter(g=>g.y>=top-.004&&g.bottom<=bottom+.004&&g.right-g.x>.001&&g.bottom-g.y>.0002&&g.bottom>.055&&g.y<.94&&!masks.some(m=>g.x>=m.x&&g.right<=m.right&&g.y>=m.y&&g.bottom<=m.bottom));
  if(!shapes.length)continue;let box={x:Math.min(...shapes.map(s=>s.x)),y:Math.min(...shapes.map(s=>s.y)),right:Math.max(...shapes.map(s=>s.right)),bottom:Math.max(...shapes.map(s=>s.bottom))};
  const original={...box};for(let round=0;round<2;round++)for(const t of texts){if(t.y<top||t.bottom>bottom||/^Fig(?:ure)?\.?\s*\d/.test(t.text)||masks.some(m=>(t.x+t.right)/2>=m.x&&(t.x+t.right)/2<=m.right&&t.y>=m.y&&t.bottom<=m.bottom))continue;
   const dx=Math.max(0,box.x-t.right,t.x-box.right),dy=Math.max(0,box.y-t.bottom,t.y-box.bottom);if(dx>.026||dy>.018||t.x<original.x-.055||t.right>original.right+.055||t.y<original.y-.045||t.bottom>original.bottom+.045)continue;box.x=Math.min(box.x,t.x);box.y=Math.min(box.y,t.y);box.right=Math.max(box.right,t.right);box.bottom=Math.max(box.bottom,t.bottom);
  }
  const padX=3/viewport.width,padY=3/viewport.height,bbox={x:Math.max(.025,box.x-padX),y:Math.max(top,box.y-padY),width:Math.min(.975,box.right+padX)-Math.max(.025,box.x-padX),height:Math.min(bottom,box.bottom+padY)-Math.max(top,box.y-padY)};
  if(!validBox(bbox)||bbox.width<.12||bbox.height<.05||bbox.width*bbox.height>.83)continue;
  regions.push({number:anchor.number,page,bbox,confidence:(shapes.length>=3||shapes.some(s=>s.image&&(s.right-s.x)*(s.bottom-s.y)>.02))?0.95:0.8,source:'pdf-operators'});
 }
 return regions;
}
const cache=new WeakMap();
export async function collectFigureRegions(doc,{ops,onProgress=()=>{}}={}){if(cache.has(doc))return cache.get(doc);const job=(async()=>{const pages=[],anchors=[];for(let n=1;n<=doc.numPages;n++){onProgress(`正在核对原图结构 ${n} / ${doc.numPages} 页…`);const page=await doc.getPage(n),viewport=page.getViewport({scale:1}),content=await page.getTextContent();anchors.push(...captionAnchors(content,viewport,n));pages.push({page:n,content,viewport,graphics:graphicsFromOperators(await page.getOperatorList(),viewport,ops)});}const regions=pages.flatMap(p=>regionsForPage(p.content,p.viewport,p.graphics,anchors,p.page));return {anchors,regions};})();cache.set(doc,job);try{return await job;}catch(e){cache.delete(doc);throw e;}}
export function regionForFigure(figure,regions=[]){const candidates=regions.filter(r=>figureKey(r.number)===figureKey(figure.number)&&r.confidence>=.85);return candidates.find(r=>r.page===figure.page)||(candidates.length===1?candidates[0]:null);}
