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
export function usageHistory(papers,curated=[]){
 const map=new Map(curated.filter(p=>!p.demo).map(p=>[p.id,p]));
 for(const p of papers)if(!p.demo){const base=map.get(p.id);map.set(p.id,{...base,...p,usage:p.usage||base?.usage,model:p.model||base?.model,preflight:p.preflight||base?.preflight});}
 return [...map.values()].map(p=>{
  const u=p.usage,measured=!!u&&['inputTokens','outputTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0);
  return {paper:p,id:p.id,paperId:p.resolvedPaperId||p.id,at:p.usageObservedAt||p.updatedAt||p.createdAt||'',origin:p.example?'文献库收录':'个人上传',measured,usage:measured?u:null,estimate:p.preflight?.preparedTextTokens??null,status:p.resolvedPaperId?'已关联解读':p.status==='failed'?'解读未完成':p.status==='processing'||p.status==='queued'?'解读中':hasPaperAnalysis(p)?'已解读':'待解读'};
 }).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
export function usageTotals(rows){return rows.reduce((a,r)=>{if(r.measured){a.input+=r.usage.inputTokens;a.output+=r.usage.outputTokens;a.total+=r.usage.totalTokens;a.measured++;}else a.unrecorded++;return a;},{input:0,output:0,total:0,measured:0,unrecorded:0});}
