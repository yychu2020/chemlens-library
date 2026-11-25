import {paperIdentity,duplicateMatch} from './paper-identity.js';
const title=p=>p.displayTitle||p.title||p.englishTitle||p.id;
export function planBackupPapers(incoming,existing){
 const accepted=[],duplicates=[],known=existing.map(p=>({paper:p,identity:paperIdentity(p),source:'existing'}));
 for(const p of incoming){const identity=paperIdentity(p),hit=known.find(x=>x.paper.id===p.id||duplicateMatch(identity,x.identity));
  if(hit){duplicates.push({paperId:p.id,title:title(p),existingId:hit.paper.id,existingTitle:title(hit.paper),match:hit.paper.id===p.id?'id':duplicateMatch(identity,hit.identity),source:hit.source});continue;}
  accepted.push(p);known.push({paper:p,identity,source:'backup'});
 }
 return {accepted,duplicates};
}
export function withoutDuplicatePapers(state,blockedIds){
 const blocked=new Set(blockedIds),out=structuredClone(state),keep=x=>!blocked.has(x.paperId||x.id);
 const blockedFigures=new Set((out.figures||[]).filter(f=>blocked.has(f.paperId)).map(f=>f.id));
 for(const key of ['papers','figures','methods','notes'])out[key]=(out[key]||[]).filter(x=>keep(x)&&!blockedFigures.has(x.figureId));
 out.removedPaperIds=(out.removedPaperIds||[]).filter(id=>!blocked.has(id));
 out.removedPaperMetadata=Object.fromEntries(Object.entries(out.removedPaperMetadata||{}).filter(([id])=>!blocked.has(id)));
 out.figureVisibility=Object.fromEntries(Object.entries(out.figureVisibility||{}).filter(([,r])=>!blocked.has(r.paperId)));
 out.backupUsageEvents=(out.backupUsageEvents||[]).filter(keep);
 const allowed=new Set(out.figures.map(f=>f.id));out.backupMyRatings=Object.fromEntries(Object.entries(out.backupMyRatings||{}).filter(([id])=>allowed.has(id)));
 return out;
}
