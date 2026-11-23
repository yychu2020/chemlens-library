import {scientificHTML,scientificMarkdown,scientificPlainText} from './scientific-text.js';
import {figureCaptionZh} from './caption-translations.js';
import {paperDisplayName} from './paper-names.js';
import {figureDisplayTitle} from './display-labels.js';
const text=v=>typeof v==='string'?v.trim():v==null?'':String(v);
const list=v=>(Array.isArray(v)?v:[v]).map(text).filter(Boolean);
const html=s=>text(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=s=>scientificMarkdown(text(s));
export function articleImageType(bytes){if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';if(String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return 'image/webp';return '';}
export function articleFilename(p){return paperDisplayName(p).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/,'').slice(0,130)||'文献解读';}
export function articleSource(p){return [p.journal,p.year,p.volume?(p.articleNumber?`${p.volume}, ${p.articleNumber}`:p.sourcePages?`${p.volume}, ${p.sourcePages}`:p.volume):p.articleNumber,p.doi?'DOI: '+p.doi:''].filter(Boolean).join(' · ');}
export function safeArticleURL(value){const s=text(value);if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s))return s;if(/^images\/[A-Za-z0-9._-]+$/.test(s))return s;try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
// Remove only a repeated caption heading; retain all panel descriptions,
// conditions and values from the original translated caption.
const captionTitleKey=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/剖面/g,'曲线').replace(/以及|与|和|及|的|建模|计算|分析/g,'').replace(/[^\p{L}\p{N}]/gu,'');
export function articleCaptionBody(figure,caption){
 const original=text(caption).replace(/^(?:\*\*|#{1,6}\s*)?图注\s*[（(]\s*中文翻译\s*[）)]\s*[:：]?\s*(?:\*\*)?\s*/u,''),withoutNumber=original.replace(/^(?:图\s*[A-Za-z]?\d+[a-z]?|(?:Fig(?:ure)?\.?|Extended Data Fig\.?)\s*[A-Za-z]?\d+[a-z]?)\s*[|｜:：.、-]?\s*/i,'');
 const title=figureDisplayTitle(figure).replace(/^图\s*[^｜|]+[｜|]\s*/,''),expected=captionTitleKey(title);
 const repeated=lead=>{const a=captionTitleKey(lead);if(!a||!expected)return false;if(a===expected)return true;if(Math.min(a.length,expected.length)<6)return false;const left=new Set([...a].slice(0,-1).map((_,i)=>a.slice(i,i+2))),right=new Set([...expected].slice(0,-1).map((_,i)=>expected.slice(i,i+2)));return 2*[...left].filter(x=>right.has(x)).length/(left.size+right.size)>=.82;};
 const end=withoutNumber.search(/[。\n]/);if(end>=0&&repeated(withoutNumber.slice(0,end)))return withoutNumber.slice(end+1).trim();
 if(repeated(withoutNumber))return '';
 const panel=withoutNumber.search(/[（(][a-h](?:[–−-][a-h])?[)）]/i);if(panel>0&&repeated(withoutNumber.slice(0,panel).replace(/[：:;；]$/,'')))return withoutNumber.slice(panel).trim();
 return withoutNumber;
}
export function articleBlocks(p,figures=[],methods=[],{images=new Map(),readingURL=''}={}){
 const blocks=[],add=(type,value,extra={})=>{if(text(value))blocks.push({type,text:text(value),...extra});},heading=(value,level=2)=>add('heading',value,{level}),para=value=>add('paragraph',value),label=(name,value)=>{if(text(value))add('label',value,{label:name});},bullets=values=>{const items=list(values);if(items.length)blocks.push({type:'list',items});};
 heading(paperDisplayName(p),1);label('中文原题',p.chineseTitle||p.title);para(p.englishTitle);para(list(p.authors).join(' · '));para(articleSource(p)||p.sourceInfo);
 const insight=p.insight||p.analysis?.insight||{},summary=typeof p.summary==='string'?{researchQuestion:p.summary,mainFindings:p.keyFindings,novelty:p.novelty,limitations:p.limitations}:p.summary||p.analysis?.summary||{};
 if(insight.scientificQuestion||summary.researchQuestion){heading('科学问题');para(insight.scientificQuestion||summary.researchQuestion);if(insight.scientificQuestion&&summary.researchQuestion&&insight.scientificQuestion!==summary.researchQuestion)label('研究背景与目标',summary.researchQuestion);}
 if(p.scientificAnswer){heading('论文给出的回答');para(p.scientificAnswer);}
 if(list(summary.mainFindings).length){heading('主要发现');bullets(summary.mainFindings);}
 if(insight.highlight||insight.reasoning||summary.novelty){heading('研究亮点');para(insight.highlight);if(insight.reasoning!==insight.highlight)para(insight.reasoning);if(summary.novelty!==insight.highlight&&summary.novelty!==insight.reasoning)label('创新与机制线索',summary.novelty);}
 const fs=[...figures].sort((a,b)=>text(a.number).localeCompare(text(b.number),'en',{numeric:true}));
 if(fs.length){heading('图表解读');for(const f of fs){heading(figureDisplayTitle(f),3);const image=safeArticleURL(images.get(f.id)||f.exportImage||'');if(image)blocks.push({type:'image',url:image,text:figureDisplayTitle(f)});else para('图片待补充，请对照原论文查看。');if(f.sourcePreview)para('此处为原文页面预览，图表选区尚待核对。');const translated=figureCaptionZh(f,p),captionBody=translated?articleCaptionBody(f,translated):'';if(translated)para(captionBody);else para('尚未录入中文图注，请对照原文补充。');const brief=articleCaptionBody(f,f.description||f.caption||'');if(brief&&captionTitleKey(brief)!==captionTitleKey(captionBody))label('简要说明',brief);label('这张图回答什么',f.question);label('坐标、图例与阅读方式',f.reading);label('关键观察',f.finding);label('适用条件与边界',f.limits);label('相关方法',f.method);if(f.page)para(`原文位置：PDF 第 ${f.page} 页。`);}}
 if(methods.length){heading('计算与技术步骤');for(const [i,m]of methods.entries()){heading(`${i+1}. ${m.title||'方法记录'}`,3);label('软件与工具',m.software);para(m.parameters||m.description);label('原文依据',m.evidence||m.evidenceText);const page=m.page||m.evidencePage;if(page)para(`原文位置：PDF 第 ${page} 页。`);}}
 if(list(summary.limitations).length||insight.caveat){heading('局限与阅读提醒');bullets(summary.limitations);para(insight.caveat);}
 if(list(p.analysis?.ideas).length){heading('后续研究思路（待验证）');bullets(p.analysis.ideas);}
 blocks.push({type:'divider'});para('本文为文献研读与写作参考，研读判断并非作者原话或官方评价。图表与数据来源于原论文，具体结论、参数及适用条件请以原文为准。');
 return blocks;
}
export function articleMarkdown(blocks){return blocks.map(b=>b.type==='heading'?'#'.repeat(b.level)+' '+md(b.text).replace(/\r?\n/g,' '):b.type==='label'?`**${md(b.label)}：**\n\n${md(b.text)}`:b.type==='list'?b.items.map(x=>'- '+md(x).replace(/\r?\n/g,'\n  ')).join('\n'):b.type==='image'?`![${md(b.text)}](${b.url})`:b.type==='link'?`[${md(b.text)}](${b.url.replace(/[()]/g,c=>c==='('?'%28':'%29')})`:b.type==='divider'?'---':md(b.text)).join('\n\n')+'\n';}
export function articlePlainText(blocks){return scientificPlainText(blocks.map(b=>b.type==='label'?b.label+'：\n'+b.text:b.type==='list'?b.items.map(x=>'• '+x).join('\n'):b.type==='link'?b.text+'：'+b.url:b.type==='image'?'【'+b.text+'】':b.type==='divider'?'——':b.text).join('\n\n'));}
export function articleHTML(blocks,{document=false,title='文献解读'}={}){
 const para='margin:0 0 18px;font-size:16px;line-height:1.9;color:#273445;text-align:justify;overflow-wrap:anywhere;',body=blocks.map(b=>{
  if(b.type==='heading'){const size=b.level===1?24:b.level===2?20:17;return `<h${b.level} style="margin:${b.level===1?'8px 0 24px':'30px 0 16px'};font-size:${size}px;line-height:1.6;font-weight:700;color:#174b7e;">${scientificHTML(b.text)}</h${b.level}>`;}
  if(b.type==='label')return `<p style="${para}"><strong>${html(b.label)}：</strong><br>${scientificHTML(b.text).replace(/\r?\n/g,'<br>')}</p>`;
  if(b.type==='list')return `<ul style="padding-left:24px;margin:0 0 20px;">${b.items.map(x=>`<li style="${para}">${scientificHTML(x).replace(/\r?\n/g,'<br>')}</li>`).join('')}</ul>`;
  if(b.type==='image')return `<p style="margin:20px 0;text-align:center;"><img src="${html(b.url)}" alt="${html(b.text)}" style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;"></p>`;
  if(b.type==='link')return `<p style="${para}"><a href="${html(b.url)}" style="color:#1965b4;text-decoration:underline;">${html(b.text)}</a></p>`;
  if(b.type==='divider')return '<hr style="border:0;border-top:1px solid #dbe4ef;margin:32px 0;">';
  return `<p style="${para}">${scientificHTML(b.text).replace(/\r?\n/g,'<br>')}</p>`;
 }).join('\n');const article=`<article style="max-width:720px;margin:0 auto;padding:24px 20px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;">${body}</article>`;
 return document?`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(title)}</title></head><body style="margin:0;background:#fff">${article}</body></html>`:article;
}
// Uncompressed ZIP keeps the already-compressed original image bytes intact.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=data=>{let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;};
export function articleZIP(files){const chunks=[],central=[],encoder=new TextEncoder();let offset=0,total=0;for(const file of files){if(!/^[^/\\]+(?:\/[^/\\]+)*$/.test(file.name)||file.name.split('/').some(x=>x==='..'||x==='.')||files.length>65535)throw Error('素材文件名无效。');const name=encoder.encode(file.name),data=typeof file.data==='string'?encoder.encode(file.data):new Uint8Array(file.data),crc=crc32(data);total+=data.length;if(total>100*1024*1024)throw Error('图文素材超过100 MiB，请分批导出。');const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,data);const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=local.length+data.length;}const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,central.reduce((n,c)=>n+c.length,0),true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
