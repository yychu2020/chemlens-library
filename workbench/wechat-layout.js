import {scientificHTML} from './scientific-text.js';

// One renderer for previews, rich clipboard, saved HTML and WeChat draft/add.
// Every visual rule is inline; no page CSS, script or external font is required.
export const WECHAT_LAYOUT_VERSION='chemlens-wechat-20261125';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rich(value){return String(value??'').split(/(`[^`\n]{1,300}`)/g).map((part,i)=>i%2?`<code style="font-family:monospace;font-size:14px;background:#f3f5f8;color:#334155;padding:1px 4px;">${escape(part.slice(1,-1))}</code>`:scientificHTML(part).replace(/\*\*([^*\n]{1,1000})\*\*/g,'<strong style="font-weight:700;">$1</strong>')).join('').replace(/\r?\n/g,'<br>');}
function safeURL(value,image=false){const s=String(value||'');if(image&&(/^images\/[A-Za-z0-9._-]+$/.test(s)||/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(s)))return s;try{const u=new URL(s);return (['http:','https:'].includes(u.protocol)||image&&u.protocol==='blob:')&&!u.username&&!u.password?u.href:'';}catch{return '';}}
const paragraph='margin:0 0 16px;';
const muted='margin:0 0 12px;font-size:14px;line-height:1.8;color:#64748b;';
export function wechatArticleHTML(blocks,{document=false,title='文献解读'}={}){
 const compact=blocks.reduce((n,b)=>n+String(b.text||'').length+(b.items||[]).join('').length,0)>8000;
 const metaEnd=blocks.some(b=>b.type==='label'&&b.label==='中文原题')?blocks.findIndex(b=>b.type==='heading'&&b.level===2):-1;
 const divider=blocks.map(b=>b.type).lastIndexOf('divider');
 const body=blocks.map((b,i)=>{
  if(b.type==='heading'){
   const level=[1,2,3].includes(b.level)?b.level:2;
   const style=compact?(level===1?'margin:4px 0 22px;font:700 23px/1.55 Arial;color:#17385f;':level===2?'margin:30px 0 16px;font:700 19px/1.6 Arial;color:#174b7e;':'margin:24px 0 12px;font:700 17px/1.7 Arial;color:#174b7e;'):level===1?'margin:4px 0 22px;font-size:23px;line-height:1.55;font-weight:700;color:#17385f;':level===2?'margin:30px 0 16px;padding:8px 12px;border-left:4px solid #2771c7;background:#f2f7fd;font-size:19px;line-height:1.6;font-weight:700;color:#174b7e;':'margin:24px 0 12px;font-size:17px;line-height:1.7;font-weight:700;color:#174b7e;';
   return `<h${level} style="${style}">${rich(b.text)}</h${level}>`;
  }
  if(b.type==='label')return `<p style="${metaEnd>i?muted:paragraph}"><strong style="font-weight:700;color:#334155;">${escape(b.label)}：</strong><br>${rich(b.text)}</p>`;
  if(b.type==='list')return `<ul style="margin:0 0 18px;padding-left:24px;list-style-type:disc;">${b.items.map(x=>`<li style="margin:0 0 10px;">${rich(x)}</li>`).join('')}</ul>`;
  if(b.type==='image'){const url=safeURL(b.url,true);return url?`<p style="margin:20px 0 10px;text-align:center;"><img src="${escape(url)}" alt="${escape(b.text)}" style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;"></p>`:'';}
  if(b.type==='link'){const url=safeURL(b.url);return `<p style="${paragraph}">${url?`<a href="${escape(url)}" style="color:#1965b4;text-decoration:underline;">${rich(b.text)}</a>`:rich(b.text)}</p>`;}
  if(b.type==='divider')return '<hr style="border:0;border-top:1px solid #dbe4ef;margin:28px 0 18px;">';
  const caption=blocks[i-1]?.type==='image',footer=divider>=0&&i>divider;
  const style=caption?'margin:0 0 18px;font-size:14px;line-height:1.8;color:#64748b;':footer?'margin:0 0 12px;font-size:13px;line-height:1.8;color:#718096;':metaEnd>i?muted:paragraph;
  return `<p style="${style}">${rich(b.text)}</p>`;
 }).join('\n');
 const article=`<section style="box-sizing:border-box;max-width:720px;margin:0 auto;padding:22px 14px;background:#fff;font-size:16px;line-height:1.9;color:#273445;text-align:justify;overflow-wrap:break-word;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;">${body}</section>`;
 return document?`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head><body style="margin:0;background:#fff">${article}</body></html>`:article;
}
