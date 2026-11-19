// Local PDF preparation: no model call, no external upload, original PDF retained.
export const PREFLIGHT_VERSION=1;
export function preparePages(texts){
 const rows=texts.map(t=>String(t).replace(/\u0000/g,'').split(/\r?\n/));
 const frequency=new Map();
 for(const lines of rows)for(const s of new Set([...lines.slice(0,3),...lines.slice(-3)].map(x=>x.trim()).filter(s=>s&&!/^\d+$/.test(s))))frequency.set(s,(frequency.get(s)||0)+1);
 const repeated=new Set([...frequency].filter(([,n])=>n>=Math.max(3,Math.ceil(rows.length*.6))).map(([s])=>s));
 let references=false;const pages=[],figurePages=[];
 rows.forEach((lines,index)=>{
  let text=lines.filter((s,j)=>{const margin=j<3||j>=lines.length-3;return !(margin&&(repeated.has(s.trim())||s.trim()===String(index+1)));}).map(s=>s.trimEnd()).join('\n').trim();
  const marker=/^\s*[■▪]?\s*(?:References|REFERENCES|参考文献)\s*$/m.exec(text);
  if(marker&&index>=Math.floor(rows.length/2)){text=text.slice(0,marker.index).trimEnd();references=true;}
  else if(references)text='';
  if(text){pages.push({pdfPage:index+1,text});if(/(?:^|\n)\s*(?:Figure|Fig\.?|图)\s*\d+[\s.:|：]/i.test(text))figurePages.push(index+1);}
 });
 return {pages,figurePages,removedReferences:references};
}
export function pdfTextLines(content){
 let lines=[],line='',lastY=null;
 for(const item of content.items){if(!('str' in item))continue;const y=item.transform?.[5];if(line&&lastY!==null&&Number.isFinite(y)&&Math.abs(y-lastY)>3){lines.push(line);line='';}line+=(line?' ':'')+item.str;lastY=y;if(item.hasEOL){lines.push(line);line='';lastY=null;}}
 if(line)lines.push(line);return lines.join('\n');
}
let encoderPromise;
async function encoder(){return encoderPromise??=(import('./vendor/tokenizer.js').then(m=>m.encoding));}
export async function preprocessPDF(doc,{onProgress=()=>{},cancelled=()=>false}={}){
 const texts=[];for(let n=1;n<=doc.numPages;n++){if(cancelled())throw new DOMException('已取消','AbortError');onProgress(`正在预处理 ${n} / ${doc.numPages} 页…`);const p=await doc.getPage(n);texts.push(pdfTextLines(await p.getTextContent()));}
 onProgress('正在本地计算 token 预估…');const prepared=preparePages(texts),enc=await encoder();
 const sourceTextTokens=enc.encode(texts.join('\n\n'),[],[]).length,preparedTextTokens=enc.encode(prepared.pages.map(p=>p.text).join('\n\n'),[],[]).length;
 const sparsePages=texts.filter(t=>t.replace(/\s/g,'').length<80).length;
 const canUsePacket=preparedTextTokens>=100&&prepared.pages.reduce((n,p)=>n+p.text.length,0)<=700000&&sparsePages<=Math.max(1,doc.numPages*.2)&&prepared.figurePages.length>0&&prepared.figurePages.length<=12;
 return {texts,preflight:{version:PREFLIGHT_VERSION,encoding:'o200k_base',modelCalls:0,sourceTextTokens,preparedTextTokens,processedPages:doc.numPages,totalPages:doc.numPages,...prepared,canUsePacket,mode:canUsePacket?'text-and-figure-pages':'original-pdf',estimatedAt:new Date().toISOString(),scope:'仅统计提取文字；提示词、图像、输出及推理另计，非实际账单。'}};
}
export async function buildAnalysisPacket(doc,preflight,{onProgress=()=>{},forcePages=false}={}){
 if(!preflight?.canUsePacket&&!forcePages)return null;const images=[];const imagePages=preflight.figurePages?.length?preflight.figurePages:Array.from({length:doc.numPages},(_,i)=>i+1);if(imagePages.length>12)throw new Error('当前智谱解读最多支持 12 个含图页面，请拆分 PDF 后上传。');
 for(const n of imagePages){onProgress(`正在准备原图页面 ${n}…`);const page=await doc.getPage(n),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1.5,1200/Math.max(base.width,base.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;images.push({pdfPage:n,dataUrl:canvas.toDataURL('image/jpeg',.75)});canvas.width=canvas.height=0;}
 const packet={version:1,pages:preflight.pages?.length?preflight.pages:[{pdfPage:1,text:'预处理程序说明（不是论文内容）：该 PDF 无可用的提取文字，属于扫描件或不可提取文本的页面。请仅依据随后附上的原始整页图像识别论文内容；所标注的 PDF 页码就是文件中的实际页序。看不清的公式、数值、来源与计算参数应明确标为待核实，不得补造；不得把本段程序说明当作论文摘要、方法或结论。'}],images};return JSON.stringify(packet).length<=5*1024*1024?packet:null;
}
