/** Deterministic, local-only paper color references. This module never calls a model API. */
export const PALETTE_METHOD='chromatic-lab-v2';
export const PALETTE_CRITERIA=Object.freeze({
  maxColors:5,mergeDistance:22,minClusterShare:.005,maxPages:20,maxEdge:400,pixelBudget:600000,
  sampling:'确定性网格分层抽样，保留图像面积权重',
  exclusions:'排除透明像素、近白底、近黑与低彩度黑灰文字',
  representative:'代表值取自真实采样像素的主要色阶，不使用 AI 猜色或补色',
  shareBasis:'过滤与合并后的主要有色色簇占比，不是整篇精确 HEX 出现率',
  tokenCost:0,
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const hex=rgb=>'#'+rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase();
const rgbKey=(r,g,b)=>(r<<16)|(g<<8)|b;
const keyRgb=key=>[(key>>16)&255,(key>>8)&255,key&255];
function lab(rgb){
 const [r,g,b]=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const [x,y,z]=[(r*.4124564+g*.3575761+b*.1804375)/.95047,r*.2126729+g*.7151522+b*.072175,(r*.0193339+g*.119192+b*.9503041)/1.08883].map(v=>v>.008856?Math.cbrt(v):7.787*v+16/116);
 return [116*y-16,500*(x-y),200*(y-z)];
}
function colored(r,g,b,a){
 if(![r,g,b,a].every(v=>Number.isFinite(v)&&v>=0&&v<=255))return false;
 const max=Math.max(r,g,b),min=Math.min(r,g,b),spread=max-min;
 return a>=160&&max>=45&&!(min>=225&&max>=245)&&spread>=24&&spread/Math.max(max,1)>=.12;
}
function settings(options={}){
 return {count:clamp(Math.round(Number(options.count)||5),1,5),mergeDistance:clamp(Number(options.mergeDistance)||22,8,35),minClusterShare:clamp(Number(options.minClusterShare??.005),0,.05),pixelBudget:clamp(Math.floor(Number(options.pixelBudget??options.maxSamples)||600000),64,1200000)};
}
function validSource(source){return source?.data&&Number.isInteger(source.width)&&Number.isInteger(source.height)&&source.width>0&&source.height>0&&source.data.length===source.width*source.height*4;}
function accumulator(options,expectedSources){
 const config=settings(options),histogram=new Map();
 const metrics={sourcePixels:0,sampledPixels:0,chromaticSamples:0,sourceCount:0,minorClustersRemoved:0};
 const quota=Math.max(1,Math.floor(config.pixelBudget/Math.max(1,expectedSources)));
 function addPixel(source,index,weight,sourceIndex){
  metrics.sampledPixels++;
  const data=source.data,r=data[index],g=data[index+1],b=data[index+2],a=data[index+3];
  if(!colored(r,g,b,a))return;
  metrics.chromaticSamples++;
  const key=((r>>4)<<8)|((g>>4)<<4)|(b>>4),exact=rgbKey(r,g,b);
  let point=histogram.get(key);
  if(!point){point={key,n:0,samples:0,rgb:[0,0,0],sources:new Set(),exact:new Map(),mode:exact,modeCount:0};histogram.set(key,point);}
  point.n+=weight;point.samples++;point.rgb[0]+=r*weight;point.rgb[1]+=g*weight;point.rgb[2]+=b*weight;point.sources.add(sourceIndex);
  const count=(point.exact.get(exact)||0)+weight;point.exact.set(exact,count);
  if(count>point.modeCount||(count===point.modeCount&&exact<point.mode)){point.mode=exact;point.modeCount=count;}
 }
 function add(source,sourceIndex){
  if(!validSource(source))return;
  const width=source.width,height=source.height,pixels=width*height;metrics.sourcePixels+=pixels;metrics.sourceCount++;
  if(pixels<=quota){for(let i=0;i<source.data.length;i+=4)addPixel(source,i,1,sourceIndex);return;}
  const cols=Math.max(1,Math.min(width,quota,Math.round(Math.sqrt(quota*width/height))));
  const rows=Math.max(1,Math.min(height,Math.floor(quota/cols))),weight=pixels/(cols*rows);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   // Fixed offsets cover each stratum without a regular-step alias against thin chart lines.
   const hash=((col*73856093)^(row*19349663)^((sourceIndex+1)*83492791))>>>0;
   const x=Math.min(width-1,Math.floor((col+(hash&65535)/65536)*width/cols));
   const y=Math.min(height-1,Math.floor((row+(hash>>>16)/65536)*height/rows));
   addPixel(source,(y*width+x)*4,weight,sourceIndex);
  }
 }
 function finish(){
  const points=[...histogram.values()].map(p=>({...p,rgb:p.rgb.map(v=>v/p.n)})).map(p=>({...p,lab:lab(p.rgb)})).filter(p=>Math.hypot(p.lab[1],p.lab[2])>=10&&p.lab[0]>=8&&p.lab[0]<=96).sort((a,b)=>b.n-a.n||a.key-b.key);
  let colors=[];
  if(points.length){
   const seeds=[points[0].lab.slice()],minDistance=config.mergeDistance**2;
   while(seeds.length<Math.min(config.count,points.length)){
    let candidate=null,best=0;
    for(const p of points){const d=Math.min(...seeds.map(s=>distance(s,p.lab)));if(d<minDistance)continue;const score=p.n*d;if(score>best){candidate=p;best=score;}}
    if(!candidate)break;seeds.push(candidate.lab.slice());
   }
   let clusters=[];
   for(let pass=0;pass<10;pass++){
    clusters=seeds.map(()=>({n:0,samples:0,rgb:[0,0,0],lab:[0,0,0],sources:new Set(),points:[]}));
    for(const p of points){let index=0,best=Infinity;seeds.forEach((seed,i)=>{const d=distance(seed,p.lab);if(d<best){best=d;index=i;}});const c=clusters[index];c.n+=p.n;c.samples+=p.samples;c.points.push(p);for(const source of p.sources)c.sources.add(source);for(let j=0;j<3;j++){c.lab[j]+=p.lab[j]*p.n;c.rgb[j]+=p.rgb[j]*p.n;}}
    clusters=clusters.filter(c=>c.n).map(c=>({...c,rgb:c.rgb.map(v=>v/c.n),lab:c.lab.map(v=>v/c.n)}));
    const moved=clusters.reduce((sum,c,i)=>sum+distance(c.lab,seeds[i]||c.lab),0);seeds.splice(0,seeds.length,...clusters.map(c=>c.lab.slice()));if(moved<.02)break;
   }
   let merged=true;
   while(merged){merged=false;clusters.sort((a,b)=>b.n-a.n||hex(a.rgb).localeCompare(hex(b.rgb)));outer:for(let i=0;i<clusters.length;i++)for(let j=i+1;j<clusters.length;j++){
    const a=clusters[i],b=clusters[j];if(distance(a.lab,b.lab)>minDistance)continue;
    const n=a.n+b.n;clusters[i]={n,samples:a.samples+b.samples,rgb:a.rgb.map((v,k)=>(v*a.n+b.rgb[k]*b.n)/n),lab:a.lab.map((v,k)=>(v*a.n+b.lab[k]*b.n)/n),sources:new Set([...a.sources,...b.sources]),points:[...a.points,...b.points]};clusters.splice(j,1);merged=true;break outer;
   }}
   const total=clusters.reduce((sum,c)=>sum+c.n,0);
   const major=clusters.filter(c=>{
    const supported=c.n/total>=config.minClusterShare||(c.sources.size>=2&&c.samples>=3&&c.n/total>=.001)||clusters.length===1;
    if(!supported)metrics.minorClustersRemoved++;return supported;
   });
   const denominator=major.reduce((sum,c)=>sum+c.n,0);
   colors=major.sort((a,b)=>b.n-a.n||hex(a.rgb).localeCompare(hex(b.rgb))).slice(0,config.count).map(c=>{
    // Restrict to this cluster and favor a supported color stage over a lone anti-aliased pixel.
    const representative=c.points.reduce((best,p)=>{const score=q=>distance(lab(keyRgb(q.mode)),c.lab)/(1+Math.log1p(q.modeCount));return score(p)<score(best)?p:best;},c.points[0]);
    const rgb=keyRgb(representative.mode);return {hex:hex(rgb),rgb,share:c.n/denominator};
   });
  }
  const messages=[];
  if(!colors.length)messages.push('未检测到足够的有色像素，不使用默认色填补。');
  else if(metrics.chromaticSamples<30)messages.push('有效有色样本较少，色卡仅供初步参考。');
  if(colors.length&&colors.length<5)messages.push(`只检测到 ${colors.length} 个可区分主要代表色，不补造颜色。`);
  if(metrics.minorClustersRemoved)messages.push(`已忽略 ${metrics.minorClustersRemoved} 个占比极小且缺少跨图支撑的色簇。`);
  return {colors,metrics,quality:{level:!colors.length?'no-color':metrics.chromaticSamples<30?'limited-samples':'reference',messages},criteria:{...PALETTE_CRITERIA,mergeDistance:config.mergeDistance,minClusterShare:config.minClusterShare,pixelBudget:config.pixelBudget},cost:{modelCalls:0,modelTokens:0,runsLocally:true}};
 }
 return {add,finish,config};
}
/** Pure local pixel analysis, with bounded, deterministic sampling and diagnostic metadata. */
export function analyzePaletteFromPixels(sources,options={}){
 if(!Array.isArray(sources))sources=[sources];const valid=sources.filter(validSource),work=accumulator(options,valid.length);valid.forEach((source,i)=>work.add(source,i));return work.finish();
}
/** Backward-compatible array-only interface. */
export function extractPaletteFromPixels(sources,options={}){return analyzePaletteFromPixels(sources,options).colors;}
function canvas(width,height){if(typeof document==='undefined')throw new Error('配色提取需要浏览器 Canvas。');const c=document.createElement('canvas');c.width=Math.max(1,Math.round(width));c.height=Math.max(1,Math.round(height));return c;}
function samplePages(total,maxPages){const n=Math.min(total,maxPages);if(n<=0)return [];if(n===1)return [1];return [...new Set(Array.from({length:n},(_,i)=>1+Math.round(i*(total-1)/(n-1))))];}
function abort(signal){if(signal?.aborted)throw new DOMException('已取消配色提取','AbortError');}
function result(analysis,{sourcePages=[],sourceFigures=[],kind,totalPages,maxEdge}){
 const annotation=kind==='pdf-pages'?`从 PDF 的 ${sourcePages.join('、')} 页抽样取色${sourcePages.length<totalPages?`（共 ${totalPages} 页，未覆盖整篇）`:''}；未识别图框时包含这些页面的所有有色内容，非整篇完整像素统计。`:'从所列完整图表抽样取色；不是作者官方调色板。';
 return {...analysis,sourcePages:[...sourcePages],sourceFigures:[...sourceFigures],method:PALETTE_METHOD,methodLabel:'本地有色像素代表色（Lab 聚类）',annotation:annotation+'已过滤白底及黑灰文字，合并相近色并忽略孤立微量色。占比为保留的主要色簇样本比例，仅作绘图参考。'+analysis.quality.messages.join(''),sampling:{kind,maxEdge,pixelBudget:analysis.criteria.pixelBudget,sampledPixels:analysis.metrics.sampledPixels,sampledPages:sourcePages.length,totalPages:totalPages??null}};
}
/** PDF.js document; explicit figure pages preferred, otherwise uniformly sample at most 20 pages. No AI request. */
export async function extractPaletteFromPdf(pdfDoc,{pages,maxPages=20,maxEdge=400,signal,onProgress,pixelBudget=600000}={}){
 const total=Math.max(0,Math.floor(pdfDoc?.numPages||0));if(!total||typeof pdfDoc.getPage!=='function')throw new Error('无法读取 PDF 页面以提取配色。');
 maxPages=clamp(Math.floor(maxPages)||20,1,20);maxEdge=clamp(Math.floor(maxEdge)||400,120,700);
 const valid=Array.isArray(pages)?[...new Set(pages.filter(n=>Number.isInteger(n)&&n>=1&&n<=total))].sort((a,b)=>a-b):[];
 const selected=valid.length?(valid.length<=maxPages?valid:samplePages(valid.length,maxPages).map(n=>valid[n-1])):samplePages(total,maxPages);
 const work=accumulator({pixelBudget},selected.length);
 for(const [index,number] of selected.entries()){
  abort(signal);const page=await pdfDoc.getPage(number);abort(signal);const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:maxEdge/Math.max(base.width,base.height)});
  const c=canvas(viewport.width,viewport.height),ctx=c.getContext('2d',{willReadFrequently:true}),task=page.render({canvasContext:ctx,viewport,background:'rgb(255,255,255)'});
  const cancel=()=>task.cancel?.();signal?.addEventListener('abort',cancel,{once:true});
  try{await task.promise;abort(signal);work.add(ctx.getImageData(0,0,c.width,c.height),index);}catch(error){abort(signal);throw error;}finally{signal?.removeEventListener('abort',cancel);c.width=1;c.height=1;}
  onProgress?.({done:index+1,total:selected.length,page:number});
  if(index%2===1)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return result(work.finish(),{sourcePages:selected,kind:'pdf-pages',totalPages:total,maxEdge});
}
/** URLs, Blobs, bitmap/canvas sources or ImageData-like values. fetch only reads image bytes, never a model API. */
export async function extractPaletteFromImages(images,{sourcePages=[],sourceFigures=[],maxEdge=400,signal,onProgress,pixelBudget=600000}={}){
 if(!Array.isArray(images))images=[images];maxEdge=clamp(Math.floor(maxEdge)||400,120,700);const work=accumulator({pixelBudget},images.length);
 for(const [index,source] of images.entries()){
  abort(signal);let bitmap=source,owned=false;
  if(validSource(source)){work.add(source,index);onProgress?.({done:index+1,total:images.length});continue;}
  if(typeof source==='string'||source instanceof URL||source instanceof Blob){
   const blob=source instanceof Blob?source:await fetch(String(source),{credentials:'same-origin',signal}).then(r=>{if(!r.ok)throw new Error('图表图像暂时无法读取。');return r.blob();});
   if(typeof createImageBitmap!=='function')throw new Error('当前浏览器不支持图像配色提取。');bitmap=await createImageBitmap(blob);owned=true;
  }
  const width=bitmap?.naturalWidth||bitmap?.width,height=bitmap?.naturalHeight||bitmap?.height;if(!width||!height)throw new Error('图表图像尺寸无效。');
  const scale=Math.min(1,maxEdge/Math.max(width,height)),c=canvas(width*scale,height*scale),ctx=c.getContext('2d',{willReadFrequently:true});
  try{ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,0,0,c.width,c.height);work.add(ctx.getImageData(0,0,c.width,c.height),index);}finally{if(owned)bitmap.close?.();c.width=1;c.height=1;}
  onProgress?.({done:index+1,total:images.length});if(index%2===1)await new Promise(resolve=>setTimeout(resolve,0));
 }
 return result(work.finish(),{sourcePages,sourceFigures,kind:'figure-images',maxEdge});
}
