import {figureCaptionZh} from './caption-translations.js';
import {articleBlocks,articleMarkdown,articlePlainText,articleHTML,articleFilename,articleZIP,articleImageType} from './article-export.js?v=20261124-narrative-export';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob);});
export function createArticleExporter({getPaper,getFigures,getMethods,resolveImage,modal,toast,download,prepareCaptions,returnToPaper}){
 let current=null;
 async function open(id){
  const paper=getPaper(id);if(!paper)return;const p=structuredClone(paper),figures=structuredClone(getFigures(id)),methods=structuredClone(getMethods(id)),session={id,p,figures,methods,assets:[],images:new Map(),ready:false,busy:false};current=session;
  modal('公众号稿件导出',`<div class="article-export-tools"><button class="button primary" data-action="article-md" disabled>下载 .md 文件</button><button class="button secondary" data-action="article-copy" disabled>一键复制图文</button><button class="button secondary" data-action="article-zip" disabled>下载图文素材包</button><button class="button ghost" data-action="article-return" data-id="${escape(id)}">返回文献</button></div><p id="article-export-status" class="helper" role="status">正在整理正文、图注和原图…</p><p class="helper">Markdown 文件内嵌图片；素材包含独立图片、Markdown 和排版预览。公众号编辑器若未接收粘贴的图片，可从素材包上传原图。</p><div id="article-export-preview" class="article-export-preview" aria-label="公众号稿件预览"></div><textarea id="article-export-fallback" class="input" hidden readonly aria-label="手动复制 Markdown"></textarea>`,{wide:true,kind:'article-export'});
  const preview=document.querySelector('#article-export-preview'),status=document.querySelector('#article-export-status');let total=0;const warnings=[];
  if(prepareCaptions)await prepareCaptions(p,figures,message=>{if(status.isConnected)status.textContent=message;});
  for(const [i,f]of figures.entries()){
   if(current!==session||!preview.isConnected)return;
   try{const src=resolveImage(f,p);if(!src||/favicon\.svg(?:$|[?#])/.test(src))throw Error('无图片');const url=new URL(src,location.href);if(!['http:','https:','data:','blob:'].includes(url.protocol)||url.protocol==='data:'&&!/^data:image\/(png|jpeg|webp);base64,/i.test(src))throw Error('图片格式不支持');const response=await fetch(url.href,{credentials:'same-origin',signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('图片暂不可用');const blob=await response.blob();if(blob.size>12*1024*1024||total+blob.size>70*1024*1024)throw Error('图片大小超限');const bytes=new Uint8Array(await blob.arrayBuffer()),mime=articleImageType(bytes);if(!mime)throw Error('图片内容格式不支持');total+=blob.size;const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';session.assets.push({id:f.id,name:`images/figure-${String(i+1).padStart(2,'0')}.${ext}`,bytes});session.images.set(f.id,await dataURL(new Blob([bytes],{type:mime})));
   }catch{warnings.push(f.number||`图 ${i+1}`);}
  }
  if(current!==session||!preview.isConnected)return;
  const reading=new URL(location.href);reading.hash='papers?paper='+encodeURIComponent(id);session.options={images:session.images,readingURL:reading.href};session.blocks=articleBlocks(p,figures,methods,session.options);session.markdown=articleMarkdown(session.blocks);session.html=articleHTML(session.blocks);session.plain=articlePlainText(session.blocks);session.ready=true;
  preview.innerHTML=session.html;const untranslated=figures.filter(f=>!figureCaptionZh(f,p)).length;status.textContent=`${figures.length} 张图表 · ${methods.length} 条计算与技术步骤 · 已准备 ${session.assets.length} 张原图。${untranslated?` ${untranslated} 张图的中文图注待补充，导出稿已标明。`:''}${warnings.length?'未载入图片：'+warnings.join('、')+'，请核对预览后补充。':''}`;
  document.querySelectorAll('.article-export-tools button[disabled]').forEach(button=>button.disabled=false);
 }
 async function action(kind){
  if(kind==='article-return'){if(current)returnToPaper(current.id);return;}
  const s=current;if(!s?.ready||s.busy||!document.querySelector('#article-export-preview'))return;
  const name=articleFilename(s.p);
  if(kind==='article-md'){download(new Blob([s.markdown],{type:'text/markdown;charset=utf-8'}),name+'.md');toast('已下载公众号 Markdown，包含正文、图片和中文图注');return;}
  if(kind==='article-zip'){
   const images=new Map(s.assets.map(a=>[a.id,a.name])),blocks=articleBlocks(s.p,s.figures,s.methods,{...s.options,images}),files=[{name:name+'.md',data:articleMarkdown(blocks)},{name:'公众号排版预览.html',data:articleHTML(blocks,{document:true,title:name})},...s.assets.map(a=>({name:a.name,data:a.bytes}))];
   try{download(articleZIP(files),name+'-图文素材包.zip');toast('已下载 Markdown、排版稿和原图素材');}catch(error){toast(error.message);}return;
  }
  if(kind==='article-copy'){
   s.busy=true;try{
    if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Rich clipboard unavailable');
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([s.html],{type:'text/html'}),'text/plain':new Blob([s.plain],{type:'text/plain'})})]);toast('已复制图文排版，可粘贴到公众号或富文本编辑器');
   }catch{
    try{await navigator.clipboard.writeText(s.markdown);toast('此浏览器仅允许复制文本，已复制完整 Markdown');}
    catch{const area=document.querySelector('#article-export-fallback');if(area){area.hidden=false;area.value=s.markdown;area.focus();area.select();toast('浏览器未允许自动复制，内容已选中，请按 Ctrl+C');}}
   }finally{s.busy=false;}
  }
 }
 return {open,action};
}
