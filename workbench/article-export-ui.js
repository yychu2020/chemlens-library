import {createWechatExporter} from './wechat-export-ui.js';
import {figureCaptionZh} from './caption-translations.js';
import {articleBlocks,articleMarkdown,articlePlainText,articleHTML,articleFilename,articleZIP,articleImageType} from './article-export.js?v=20261124-narrative-export';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob);});
export function createArticleExporter({getPaper,getFigures,getMethods,resolveImage,modal,toast,download,prepareCaptions,returnToPaper,getAccess=()=>({})}){
 let current=null;const dispose=()=>{for(const url of current?.objectURLs||[])URL.revokeObjectURL(url);current=null;};const wechat=createWechatExporter({getSession:()=>current,getAccess,modal,toast});
 async function open(id){
  const paper=getPaper(id);if(!paper)return;dispose();const p=structuredClone(paper),figures=getFigures(id).map(f=>({...f})),methods=getMethods(id).map(m=>({...m})),session={id,p,figures,methods,assets:[],objectURLs:[],images:new Map(),ready:false,busy:false};current=session;
  modal('公众号稿件导出',`<div class="article-export-tools">${getAccess().authenticated&&!getAccess().staticReader?'<button class="button secondary" data-action="article-wechat-settings">关联公众号</button><button class="button primary" data-action="article-wechat" disabled>导入公众号草稿箱</button>':''}<button class="button primary" data-action="article-md" disabled>下载 .md 文件</button><button class="button secondary" data-action="article-copy" disabled>一键复制图文</button><button class="button secondary" data-action="article-zip" disabled>下载图文素材包</button><button class="button ghost" data-action="article-return" data-id="${escape(id)}">返回文献</button></div><p id="article-export-status" class="helper" role="status">正在整理正文、图注和原图…</p><p class="helper">预览、复制图文与草稿导入共用公众号行内排版：标题、段距、列表和图注样式随正文一起发送。Markdown 文件保留原始结构，素材包含独立图片与排版HTML。</p><div id="article-export-preview" class="article-export-preview" aria-label="公众号稿件预览"></div><textarea id="article-export-fallback" class="input" hidden readonly aria-label="手动复制 Markdown"></textarea>`,{wide:true,kind:'article-export'});
  const preview=document.querySelector('#article-export-preview'),status=document.querySelector('#article-export-status');let total=0;const warnings=[];
  if(prepareCaptions)await prepareCaptions(p,figures,message=>{if(status.isConnected)status.textContent=message;});
  for(const [i,f]of figures.entries()){
   if(current!==session||!preview.isConnected)return;
   try{const src=resolveImage(f,p);if(!src||/favicon\.svg(?:$|[?#])/.test(src))throw Error('无图片');const url=new URL(src,location.href);if(!['http:','https:','data:','blob:'].includes(url.protocol)||url.protocol==='data:'&&!/^data:image\/(png|jpeg|webp);base64,/i.test(src))throw Error('图片格式不支持');const response=await fetch(url.href,{credentials:'same-origin',signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('图片暂不可用');const blob=await response.blob();if(blob.size>12*1024*1024||total+blob.size>36*1024*1024)throw Error('图片大小超限');const bytes=new Uint8Array(await blob.arrayBuffer()),mime=articleImageType(bytes);if(!mime)throw Error('图片内容格式不支持');total+=blob.size;const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';session.assets.push({id:f.id,name:`images/figure-${String(i+1).padStart(2,'0')}.${ext}`,bytes});const previewURL=URL.createObjectURL(new Blob([bytes],{type:mime}));session.objectURLs.push(previewURL);session.images.set(f.id,previewURL);
   }catch{warnings.push(f.number||`图 ${i+1}`);}
  }
  if(current!==session||!preview.isConnected)return;
  const reading=new URL(location.href);reading.hash='papers?paper='+encodeURIComponent(id);session.options={images:session.images,readingURL:reading.href};session.blocks=articleBlocks(p,figures,methods,session.options);session.markdown=articleMarkdown(session.blocks);session.html=articleHTML(session.blocks);session.plain=articlePlainText(session.blocks);session.ready=true;
  preview.innerHTML=session.html;const untranslated=figures.filter(f=>!figureCaptionZh(f,p)).length;status.textContent=`${figures.length} 张图表 · ${methods.length} 条计算与技术步骤 · 已准备 ${session.assets.length} 张原图。${untranslated?` ${untranslated} 张图的中文图注待补充，导出稿已标明。`:''}${warnings.length?'未载入图片：'+warnings.join('、')+'，请核对预览后补充。':''}`;
  document.querySelectorAll('.article-export-tools button[disabled]').forEach(button=>button.disabled=false);
 }
 async function serialized(s){const images=new Map();for(const a of s.assets){const type=articleImageType(a.bytes);images.set(a.id,await dataURL(new Blob([a.bytes],{type})));}const blocks=s.reportOnly?s.blocks:articleBlocks(s.p,s.figures,s.methods,{...s.options,images});return {blocks,markdown:articleMarkdown(blocks),html:articleHTML(blocks),plain:articlePlainText(blocks)};}
 async function openReview(review){
  dispose();const canvas=document.createElement('canvas');canvas.width=900;canvas.height=383;const ctx=canvas.getContext('2d');ctx.fillStyle='#13365e';ctx.fillRect(0,0,900,383);ctx.fillStyle='#7cceff';ctx.font='28px sans-serif';ctx.fillText('ChemLens · '+review.date,52,85);ctx.fillStyle='#fff';ctx.font='bold 48px sans-serif';ctx.fillText(review.dates?.length>1?'高相关文献汇总':'高相关文献日报',52,180);ctx.font='26px sans-serif';ctx.fillText((review.dates?.length>1?'自选'+review.dates.length+'天 · ':'实验与计算 · ')+review.papers.length+' 篇精选',52,253);const blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',.9)),bytes=new Uint8Array(await blob.arrayBuffer()),url=URL.createObjectURL(blob),p={title:review.title,dailyReview:true,summary:{mainFindings:[review.digest]},insight:{highlight:review.digest}};
  const session={id:'daily-review',p,figures:[{id:'daily-cover',title:'日报封面',number:'封面'}],methods:[],assets:[{id:'daily-cover',name:'images/daily-cover.jpg',bytes}],objectURLs:[url],images:new Map([['daily-cover',url]]),blocks:review.blocks,ready:true,busy:false,reportOnly:true};current=session;session.html=articleHTML(session.blocks);session.markdown=articleMarkdown(session.blocks);session.plain=articlePlainText(session.blocks);
  modal('当天文献日报导出',`<div class="article-export-tools"><button class="button primary" data-action="article-wechat">导入公众号草稿箱</button><button class="button secondary" data-action="article-md">下载 .md 文件</button><button class="button secondary" data-action="article-copy">复制日报</button></div><p class="helper">按所选筛选日期生成汇总，不保存汇总稿历史；预览与草稿导入共用公众号行内排版，导入前可修改标题、摘要与封面。</p><div id="article-export-preview" class="article-export-preview">${session.html}</div><textarea id="article-export-fallback" hidden readonly></textarea>`,{wide:true,kind:'article-export'});
 }
 async function action(kind){
  if(kind.startsWith('article-wechat'))return wechat.action(kind);
  if(kind==='article-return'){if(current){const id=current.id;dispose();returnToPaper(id);}return;}
  const s=current;if(!s?.ready||s.busy||!document.querySelector('#article-export-preview'))return;
  const name=s.p.dailyReview?s.p.title:articleFilename(s.p);
  if(kind==='article-md'){const rendered=await serialized(s);download(new Blob([rendered.markdown],{type:'text/markdown;charset=utf-8'}),name+'.md');toast('已下载公众号 Markdown，包含正文、图片和中文图注');return;}
  if(kind==='article-zip'){
   const images=new Map(s.assets.map(a=>[a.id,a.name])),blocks=articleBlocks(s.p,s.figures,s.methods,{...s.options,images}),files=[{name:name+'.md',data:articleMarkdown(blocks)},{name:'公众号排版预览.html',data:articleHTML(blocks,{document:true,title:name})},...s.assets.map(a=>({name:a.name,data:a.bytes}))];
   try{download(articleZIP(files),name+'-图文素材包.zip');toast('已下载 Markdown、排版稿和原图素材');}catch(error){toast(error.message);}return;
  }
  if(kind==='article-copy'){
   s.busy=true;try{
    const rendered=await serialized(s);
    if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Rich clipboard unavailable');
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([rendered.html],{type:'text/html'}),'text/plain':new Blob([rendered.plain],{type:'text/plain'})})]);toast('已复制图文排版，可粘贴到公众号或富文本编辑器');
   }catch{
    try{await navigator.clipboard.writeText(s.markdown);toast('此浏览器仅允许复制文本，已复制完整 Markdown');}
    catch{const area=document.querySelector('#article-export-fallback');if(area){area.hidden=false;area.value=s.markdown;area.focus();area.select();toast('浏览器未允许自动复制，内容已选中，请按 Ctrl+C');}}
   }finally{s.busy=false;}
  }
 }
 return {open,openReview,action,wechatSettingsView:wechat.settingsView,bindWechatSettings:wechat.bindSettings};
}
