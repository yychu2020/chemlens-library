export function hasPaperAnalysis(p){
 if(p.resolvedPaperId||p.example||p.status==='completed'||p.analysis||p.cloudAnalysisApplied)return true;
 const s=p.summary;return typeof s==='string'?!!s.trim():!!(s&&((s.researchQuestion||'').trim()||(s.mainFindings||[]).length));
}
export function isPendingPaper(p){return !p.demo&&!hasPaperAnalysis(p);}
const filenameKey=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function linkReviewedUploads(state,curated){
 const known=curated.filter(p=>p.sourceSha256&&hasPaperAnalysis(p));
 for(const p of state.papers){if(p.example||hasPaperAnalysis(p))continue;
  const match=known.find(k=>p.id!==k.id&&(p.sourceSha256?p.sourceSha256===k.sourceSha256:p.pages===k.pages&&filenameKey(p.filename)&&filenameKey(p.filename)===filenameKey(k.filename)));
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
 for(const p of map.values())for(const task of p.figureRepairs||[]){const u=task.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);rows.push({paper:{...p,model:task.model},id:p.id+':repair:'+task.id,paperId:p.id,at:task.updatedAt||task.createdAt,origin:'图片勘误 · '+task.number,measured,usage:measured?u:null,estimate:null,status:({completed:'勘误完成',processing:'勘误中',needs_review:'需人工核对',failed:'勘误未完成'})[task.status]||'勘误记录'});}
 for(const event of events){const linked=[...map.values()].find(p=>p.sourceSha256===event.sourceSha256),u=event.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);rows.push({paper:linked?{...linked,model:event.model}:{title:event.title,journal:event.journal,year:event.year,model:event.model},id:event.id,paperId:linked?.id||'',at:event.at,origin:event.origin,measured,usage:measured?u:null,estimate:null,status:event.status});}
 return rows.sort((a,b)=>(b.at||'').localeCompare(a.at||'')||a.id.localeCompare(b.id));
}
export function usageTotals(rows){return rows.reduce((a,r)=>{if(r.measured){a.input+=r.usage.inputTokens;a.output+=r.usage.outputTokens;a.total+=r.usage.totalTokens;a.measured++;}else a.unrecorded++;return a;},{input:0,output:0,total:0,measured:0,unrecorded:0});}
