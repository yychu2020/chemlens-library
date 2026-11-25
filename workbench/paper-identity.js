export function normalizeDOI(value=''){
 let text=String(value).normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'');try{text=decodeURIComponent(text);}catch{}
 const match=text.match(/10\.\d{4,9}\/[a-z0-9._;():/+%-]+/i);if(!match)return '';
 let doi=match[0].replace(/[.,;:]+$/,'');while(doi.endsWith(')')&&(doi.match(/\)/g)||[]).length>(doi.match(/\(/g)||[]).length)doi=doi.slice(0,-1);return doi.toLowerCase();
}
export const normalizePaperTitle=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const pdfSHA256=bytes=>hash(bytes);
export function paperIdentity(p={}){const m=p.analysis?.metadata||p.metadata||{},saved=p.documentIdentity||p.identity||{};const title=p.englishTitle||m.englishTitle||saved.title||'',year=String(p.year||m.year||saved.year||'');return {sha256:p.sourceSha256||p.requestHash||saved.sha256||'',doi:normalizeDOI(p.doi||m.doi||saved.doi||p.url||m.url),title,year:/^(19|20)\d{2}$/.test(year)?year:'',titleKey:normalizePaperTitle(title),contentHash:saved.contentHash||''};}
export function duplicateMatch(a,b){
 if(a.sha256&&a.sha256===b.sha256)return 'sha256';
 if(a.doi&&a.doi===b.doi)return 'doi';
 if(a.contentHash&&a.contentHash===b.contentHash)return 'content';
 if(a.titleKey.length>=35&&a.titleKey===b.titleKey&&a.year&&a.year===b.year)return 'title-year';
 return '';
}
export function findPaperDuplicate(identity,papers){for(const p of papers){const match=duplicateMatch(identity,paperIdentity(p));if(match)return {paper:p,match};}return null;}
function textLines(content){let out=[],line='',y;for(const t of content.items){if(typeof t.str!=='string')continue;const next=t.transform?.[5];if(line&&Number.isFinite(y)&&Math.abs(next-y)>3){out.push(line);line='';}line+=(line?' ':'')+t.str;y=next;if(t.hasEOL){out.push(line);line='';y=undefined;}}if(line)out.push(line);return out.join('\n');}
export async function identityFromPDF(doc,sha256,{url=''}={}){
 const texts=[];for(let n=1;n<=Math.min(doc.numPages,3);n++)texts.push(textLines(await(await doc.getPage(n)).getTextContent()));
 let info={};try{info=(await doc.getMetadata()).info||{};}catch{}
 const first=texts[0]||'',subject=String(info.Subject||''),doi=normalizeDOI(subject)||normalizeDOI(first)||normalizeDOI(url),title=String(info.Title||'').trim();
 const cleanTitle=title.length>=35&&!/^(?:untitled|microsoft|cs\d|[a-z]{1,4}\d+[ ._-])/i.test(title)?title:'';
 const years=[...first.matchAll(/\b((?:19|20)\d{2})\b/g)].map(x=>x[1]),year=years.find(y=>new RegExp('(?:©|Copyright|Communications|Catal\\.|Science|Edition|Materials).{0,30}'+y,'i').test(first))||years[0]||'';
 const stable=texts.join('\n').split('\n').filter(line=>!/(?:Downloaded|https?:\/\/|doi\.org|pubs\.acs\.org|All rights reserved|^\s*\d+\s*$)/i.test(line)).join(' ').normalize('NFKC').replace(/-\s+/g,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase().slice(0,18000);
 return {sha256,doi,title:cleanTitle,year,titleKey:normalizePaperTitle(cleanTitle),contentHash:stable.length>=1000?await hash(stable):''};
}
