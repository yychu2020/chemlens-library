export function hasPaperAnalysis(p){
 if(p.resolvedPaperId||p.example||p.status==='completed'||p.analysis||p.cloudAnalysisApplied)return true;
 const s=p.summary;return typeof s==='string'?!!s.trim():!!(s&&((s.researchQuestion||'').trim()||(s.mainFindings||[]).length));
}
export function isPendingPaper(p){return !p.demo&&!hasPaperAnalysis(p);}
export function canRetryAnalysis(p){return p?.status==='failed'&&!p.analysis&&['AI_RESULT_INVALID','AI_RESULT_INCOMPLETE','AI_TASK_FAILED','AI_REFUSED','PDF_PREPARATION_FAILED','AI_RATE_LIMITED','AI_AUTH_FAILED','AI_UPSTREAM_ERROR'].includes(p.error?.code)&&(p.analysisAttempts||[]).length<10;}
const filenameKey=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function linkReviewedUploads(state,curated){
 for(const p of state.papers){if(p.manualEdited)continue;if(hasPaperAnalysis(p)&&p.journal&&p.year&&state.figures?.some(f=>f.paperId===p.id)&&state.methods?.some(m=>m.paperId===p.id))continue;
  const match=matchingReviewedPaper(p,curated);
  if(match)p.resolvedPaperId=match.id;
 }
 return state;
}
export function usageHistory(papers,curated=[],events=[]){
 const map=new Map(curated.filter(p=>!p.demo).map(p=>[p.id,p]));
 for(const p of papers)if(!p.demo){const base=map.get(p.id);map.set(p.id,{...base,...p,usage:p.usage||base?.usage,model:p.model||base?.model,preflight:p.preflight||base?.preflight});}
 const rows=[...map.values()].map(p=>{
  const u=p.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);
  return {paper:p,id:p.id,paperId:p.resolvedPaperId||p.id,at:p.usageObservedAt||p.updatedAt||p.createdAt||'',origin:p.analysisOrigin==='reviewed-library'?'关联库内解读（未新调用AI）':p.example?'文献库收录':'个人上传',measured,usage:measured?u:null,estimate:p.preflight?.preparedTextTokens??null,status:p.resolvedPaperId?'已关联解读':p.status==='failed'?'解读未完成':p.status==='processing'||p.status==='queued'?'解读中':hasPaperAnalysis(p)?'已解读':'待解读'};
 }).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
 for(const p of map.values())for(const task of p.captionTranslations||[]){const u=task.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);rows.push({paper:{...p,model:task.model},id:p.id+':caption:'+task.id,paperId:p.id,at:task.updatedAt||task.createdAt,origin:'图注中文补译',measured,usage:measured?u:null,estimate:null,status:({completed:'补译完成',processing:'补译中',needs_review:'需人工核对',failed:'补译未完成'})[task.status]||'图注补译记录'});}
 for(const p of map.values())for(const attempt of p.analysisAttempts||[]){const u=attempt.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);rows.push({paper:{...p,model:attempt.model},id:p.id+':attempt:'+attempt.id,paperId:p.id,at:attempt.at,origin:'历史解读尝试',measured,usage:measured?u:null,estimate:null,status:'解读未完成'});}
 for(const p of map.values())for(const task of p.figureRepairs||[]){const u=task.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);rows.push({paper:{...p,model:task.model},id:p.id+':repair:'+task.id,paperId:p.id,at:task.updatedAt||task.createdAt,origin:'图片勘误 · '+task.number,measured,usage:measured?u:null,estimate:null,status:({completed:'勘误完成',processing:'勘误中',needs_review:'需人工核对',failed:'勘误未完成'})[task.status]||'勘误记录'});}
 for(const event of events){const linked=[...map.values()].find(p=>event.paperId?p.id===event.paperId:!!event.sourceSha256&&p.sourceSha256===event.sourceSha256),u=event.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);rows.push({paper:linked?{...linked,model:event.model}:{title:event.title||'图表问答',journal:event.journal||'',year:event.year||'',model:event.model},id:event.id,paperId:linked?.id||'',at:event.at,origin:event.origin,measured,usage:measured?u:null,estimate:null,status:event.status});}
 return rows.sort((a,b)=>(b.at||'').localeCompare(a.at||'')||a.id.localeCompare(b.id));
}
export function usageTotals(rows){return rows.reduce((a,r)=>{if(r.measured){a.input+=r.usage.inputTokens;a.output+=r.usage.outputTokens;a.total+=r.usage.totalTokens;a.measured++;}else a.unrecorded++;return a;},{input:0,output:0,total:0,measured:0,unrecorded:0});}
import {normalizeDOI} from './paper-identity.js';
export function matchingReviewedPaper(p,curated){const known=curated.filter(k=>k.id!==p.id&&k.sourceSha256&&hasPaperAnalysis(k));if(p.sourceSha256)return known.find(k=>p.sourceSha256===k.sourceSha256);const doi=normalizeDOI(p.doi||p.analysis?.metadata?.doi||p.url);return known.find(k=>doi?doi===normalizeDOI(k.doi):p.pages===k.pages&&filenameKey(p.filename)&&filenameKey(p.filename)===filenameKey(k.filename));}
export function restoreCuratedRecords(state,curated){for(const base of curated.papers){const p=state.papers.find(x=>x.id===base.id);if(!p)continue;for(const key of ['title','englishTitle','authors','journal','year','volume','doi','url','sourcePages','researchFields','summary']){const value=p[key];if(value==null||value===''||Array.isArray(value)&&!value.length||typeof value==='string'&&/^待|待核实|来源信息待/.test(value)){if(base[key]!==undefined)p[key]=structuredClone(base[key]);}}if(!p.insightEdited&&(!p.insight||/^待研读|待梳理/.test(p.insight.highlight||'')))p.insight=structuredClone(base.insight);if(!p.shortTitleEdited&&base.shortTitle)p.shortTitle=base.shortTitle;if(p.example&&p.cloud){p.cloud=false;p.pdfUrl=base.pdfUrl;}for(const key of ['figures','methods'])for(const item of curated[key].filter(x=>x.paperId===base.id))if(!state[key].some(x=>x.id===item.id))state[key].push(structuredClone(item));}return linkReviewedUploads(state,curated.papers);}
