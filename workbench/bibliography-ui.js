import {normalizeDOI} from './paper-identity.js';
import {publicationDateLabel} from './paper-publication.js';
export function createBibliography({getAccess,getPapers,refresh}){
 let records=[],loaded=false,loading=false;const pending=new Set(),attempted=new Set();let queue=Promise.resolve();
 const match=(r,p)=>r.paperId===p.id||r.doi&&r.doi===normalizeDOI(p.doi||p.url);
 async function api(options){const r=await fetch('/api/paper-bibliography',{credentials:'same-origin',...options,signal:AbortSignal.timeout(45000)}),d=await r.json();if(!r.ok)throw Error(d.error?.message||'来源信息暂不可用');return d;}
 function apply(p){if(!p)return p;const matches=records.filter(r=>match(r,p)),r=matches[0];if(!r)return p;const result={...p,...r,id:p.id},pdf=matches.find(r=>r.dateSource==='pdf'&&r.publicationDate);if(pdf)for(const k of ['publicationDate','dateKind','dateSource'])result[k]=pdf[k];return result;}
 async function load(force=false){if(loading||loaded&&!force)return;loading=true;try{const publicData=await fetch('/api/library-bibliography').then(r=>r.ok?r.json():({records:[]}));records=(publicData.records||[]).map(r=>({...r,publicCatalog:true}));if(getAccess().authenticated){const d=await api();records=[...(d.records||[]),...records];}loaded=true;}catch{}finally{loaded=true;loading=false;refresh();}}
 async function ensure(p,pdfDate,{force=false}={}){if(!getAccess().authenticated||!p?.id||pending.has(p.id)||(!force&&!pdfDate&&attempted.has(p.id)))return;pending.add(p.id);attempted.add(p.id);try{const d=await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paperId:p.id,doi:normalizeDOI(p.doi||p.url),...(pdfDate?{pdfDate}:{})})});records=records.filter(r=>r.publicCatalog||!match(r,p));records.unshift(d.record);refresh();}catch{}finally{pending.delete(p.id);}}
 function activate(){if(!loaded){void load();return;}if(!getAccess().authenticated)return;for(const p of getPapers()){if(!p.doi&&!p.cloud)continue;const existing=records.find(r=>match(r,p));if(existing?.checkedAt&&existing.pdfDateChecked&&Date.now()-Date.parse(existing.checkedAt)<7*86400000)continue;if(attempted.has(p.id))continue;attempted.add(p.id);queue=queue.then(async()=>{attempted.delete(p.id);await ensure(p);});}}
 function badge(p){p=apply(p);return `<span class="oa-badge ${p.isOA===true?'oa-open':p.isOA===false?'oa-closed':'oa-unknown'}">${p.isOA===true?'OA 开放获取':p.isOA===false?'非 OA':'OA 待查询'}</span>`;}
 return {load,activate,apply,ensure,badge,dateLabel:p=>publicationDateLabel(apply(p))};
}
