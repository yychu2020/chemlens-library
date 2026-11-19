// Shared PDF figure geometry. Coordinates always use the rendered PDF page, top-left origin.
export const GEOMETRY_VERSION=2;
export function figureKey(value=''){return String(value).normalize('NFKC').toLowerCase().replace(/^(?:figure|fig\.?|图)\s*/i,'').replace(/[\s.]+/g,'').replace(/[|｜:：].*$/,'');}
export function validBox(b){return !!b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.x>=0&&b.y>=0&&b.width>=.005&&b.height>=.002&&b.x+b.width<=1.001&&b.y+b.height<=1.001;}
export function captionAnchors(content,viewport,page){
 const rows=[];
 for(const item of content.items||[]){if(typeof item.str!=='string'||!item.str.trim()||!item.transform)continue;const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]),h=Math.max(3,Math.abs(item.height||item.transform[3]||8)*viewport.scale),w=Math.abs(item.width||item.str.length*h*.4)*viewport.scale;let row=rows.find(r=>Math.abs(r.baseline-y)<Math.max(2,h*.25));if(!row){row={baseline:y,items:[]};rows.push(row);}row.items.push({text:item.str,x,y:y-h,w,h});}
 const anchors=[];
 for(const row of rows){row.items.sort((a,b)=>a.x-b.x);const text=row.items.map(i=>i.text).join(' ').replace(/\s+/g,' ').trim();const m=/^(?:Fig(?:ure)?\.?|图)\s*(\d+)\s*(?:[|｜:：.]\s*|(?=[A-Z\u3400-\u9fff]))/.exec(text);if(!m||/^[a-z]/.test(text.slice(m[0].length)))continue;const left=Math.min(...row.items.map(i=>i.x)),top=Math.min(...row.items.map(i=>i.y)),right=Math.max(...row.items.map(i=>i.x+i.w)),bottom=Math.max(...row.items.map(i=>i.y+i.h));const bbox={x:Math.max(0,left/viewport.width),y:Math.max(0,top/viewport.height),width:Math.min(1,(right-left)/viewport.width),height:Math.min(1,(bottom-top)/viewport.height)};if(validBox(bbox)&&top/viewport.height>.06&&top/viewport.height<.97)anchors.push({number:'Fig. '+m[1],page,bbox,text:text.slice(0,700)});}
 return anchors;
}
export function resolveFigureGeometry(figure,anchors=[]){
 const matches=anchors.filter(a=>figureKey(a.number)===figureKey(figure.number));let anchor=matches.find(a=>a.page===figure.page);if(!anchor&&matches.length===1&&matches[0].page===figure.page)anchor=matches[0];
 const page=figure.page;let bbox=validBox(figure.bbox)?{...figure.bbox}:null;
 // A box from another page is never reused on the newly identified figure page.
 if(page!==figure.page)bbox=null;
 if(bbox&&anchor){const bottom=anchor.bbox.y-.003;if(bbox.y>=bottom||bottom-bbox.y<.035)bbox=null;else if(bbox.y+bbox.height>bottom)bbox.height=bottom-bbox.y;}
 return {page,bbox,anchor,needsReview:!bbox,version:GEOMETRY_VERSION};
}
// Expand only outwards into nearby whitespace; never trim away a panel or legend.
export function snapFigureBox(pixels,width,height,box,anchor=null){
 if(!validBox(box))return null;
 let left=Math.floor(box.x*width),top=Math.floor(box.y*height),right=Math.ceil((box.x+box.width)*width),bottom=Math.ceil((box.y+box.height)*height);
 const cap=anchor?Math.floor((anchor.bbox.y-.003)*height):height;bottom=Math.min(bottom,cap);
 const ink=(x,y)=>{const i=(y*width+x)*4;return pixels[i+3]>20&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<230;};
 const quietRow=y=>{let n=0,total=0;for(let x=Math.max(0,left);x<Math.min(width,right);x+=2){total++;if(ink(x,y))n++;}return n<=Math.max(1,total*.004);};
 const quietCol=x=>{let n=0,total=0;for(let y=Math.max(0,top);y<Math.min(height,bottom);y+=2){total++;if(ink(x,y))n++;}return n<=Math.max(1,total*.004);};
 for(let y=top;y>=Math.max(0,top-Math.ceil(height*.035));y--)if(quietRow(y)&&quietRow(Math.max(0,y-1))){top=y;break;}
 for(let y=bottom;y<Math.min(cap,height,bottom+Math.ceil(height*.035));y++)if(quietRow(y)&&quietRow(Math.min(height-1,y+1))){bottom=y+1;break;}
 for(let x=left;x>=Math.max(0,left-Math.ceil(width*.025));x--)if(quietCol(x)){left=x;break;}
 for(let x=right;x<Math.min(width,right+Math.ceil(width*.025));x++)if(quietCol(x)){right=x+1;break;}
 return {x:left/width,y:top/height,width:(right-left)/width,height:(bottom-top)/height};
}
export async function collectCaptionAnchors(doc){const out=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n);out.push(...captionAnchors(await p.getTextContent(),p.getViewport({scale:1}),n));}return out;}
export function annotateCoordinateGrid(context,width,height){context.save();context.strokeStyle='rgba(30,90,180,.18)';context.fillStyle='rgba(15,65,140,.85)';context.lineWidth=.6;context.setLineDash([3,6]);context.font='10px monospace';for(let i=1;i<10;i++){const x=width*i/10,y=height*i/10;context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();context.beginPath();context.moveTo(0,y);context.lineTo(width,y);context.stroke();context.fillText((i/10).toFixed(1),x+2,11);context.fillText((i/10).toFixed(1),2,y-2);}context.restore();}
// Use caption-separated page bands and dense prose masks to recover full figure panels.
export function localFigureBox(content,viewport,pixels,width,height,figure,anchors=[]){
 const target=anchors.find(a=>figureKey(a.number)===figureKey(figure.number)&&a.page===figure.page),same=anchors.filter(a=>a.page===figure.page&&a.bbox.y<(target?.bbox.y??1)).sort((a,b)=>b.bbox.y-a.bbox.y);
 let top=.055,bottom=target?target.bbox.y-.004:.945;
 if(target&&same.length)top=Math.max(top,same[0].bbox.y+same[0].bbox.height);
 const rows=[];
 for(const item of content.items||[]){if(!item.str?.trim()||!item.transform)continue;const [xx,yy]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]),x=xx/viewport.width,y=yy/viewport.height,h=Math.abs(item.height||item.transform[3]||8)*viewport.scale/viewport.height,w=Math.abs(item.width||0)*viewport.scale/viewport.width,col=x<.5?0:1;let row=rows.find(r=>r.col===col&&Math.abs(r.y-y)<.003);if(!row){row={col,y,h,x,right:x+w,parts:[]};rows.push(row);}row.x=Math.min(row.x,x);row.right=Math.max(row.right,x+w);row.parts.push(item.str);row.h=Math.max(row.h,h);}
 const masks=[];
 for(const col of [0,1]){const lines=rows.filter(r=>r.col===col).sort((a,b)=>a.y-b.y);let group=[];const flush=()=>{if(group.length>=4){const first=group[0],last=group.at(-1),prev=lines[lines.indexOf(first)-1];masks.push({x:Math.min(...group.map(r=>r.x))-.004,right:Math.max(...group.map(r=>r.right))+.004,top:prev&&first.y-prev.y<.03?prev.y-prev.h-.003:first.y-first.h-.003,bottom:last.y+.008});}group=[];};for(const line of lines){const text=line.parts.join(' '),prose=(text.match(/[A-Za-z]{3,}/g)||[]).length>=5||(text.match(/[\u3400-\u9fff]/g)||[]).length>=20;if(prose&&(!group.length||line.y-group.at(-1).y<.027))group.push(line);else{flush();if(prose)group=[line];}}flush();}
 let minX=width,minY=height,maxX=-1,maxY=-1,count=0;
 for(let y=Math.ceil(top*height);y<Math.floor(bottom*height);y+=2)for(let x=Math.floor(.04*width);x<Math.ceil(.96*width);x+=2){const nx=x/width,ny=y/height;if(masks.some(m=>nx>=m.x&&nx<=m.right&&ny>=m.top&&ny<=m.bottom))continue;const i=(y*width+x)*4;if(pixels[i+3]>20&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<215){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
 if(maxX<0||count*4<width*height*.003||(maxX-minX)<width*.12||(maxY-minY)<height*.06)return null;
 const box={x:Math.max(.035,(minX-6)/width),y:Math.max(top,(minY-6)/height),width:Math.min(.965,(maxX+8)/width)-Math.max(.035,(minX-6)/width),height:Math.min(bottom,(maxY+8)/height)-Math.max(top,(minY-6)/height)};
 if(!target&&validBox(figure.bbox)){const a=figure.bbox,ix=Math.max(0,Math.min(a.x+a.width,box.x+box.width)-Math.max(a.x,box.x)),iy=Math.max(0,Math.min(a.y+a.height,box.y+box.height)-Math.max(a.y,box.y));if(ix*iy<Math.min(a.width*a.height,box.width*box.height)*.25)return null;}
 return validBox(box)?box:null;
}
