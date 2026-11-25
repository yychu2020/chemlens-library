import {paperIdentity,normalizePaperTitle,normalizeDOI} from './paper-identity.js';
export const DISCOVERY_VERSION=1;
export const DISCOVERY_BATCH_SIZE=12;
export const DISCOVERY_RULE='research-overlap-v2';
export const DISCOVERY_THRESHOLD=4;
export const DISCOVERY_PROFILE='反应：电催化（ORR、OER、HER、丙烯电氧化）、耦合水电解、燃料电池。\n材料：M–N–C单/双原子、铂基合金、纳米团簇、过渡金属氧化物。\n方法：DFT、机器学习势、分子动力学、AI驱动材料发现。';
// Journal selection and the relevance rubric follow Smart_RSS_V4.py. No account
// credentials or personal search results from the desktop script are embedded.
export const DISCOVERY_JOURNALS=[
 ['Nature Communications','2041-1723'],['JACS','0002-7863'],['Angewandte Chemie','1521-3773'],['Nature','0028-0836'],['Nature Energy','2058-7546'],['Nature Catalysis','2520-1158'],['Science','1095-9203'],['Science Advances','2375-2548'],['Nature Nanotechnology','1748-3387'],['Nature Chemistry','1755-4330'],['Nature Materials','1476-1122'],['Nature Synthesis','2731-0582'],['Nature Water','2731-6084'],['Nature Protocols','1759-5045'],['Nature Machine Intelligence','2522-5839'],['Nature Computational Science','2662-8457'],['npj Computational Materials','2057-3960'],['ACS Catalysis','2155-5435'],['JACS Au','2691-3704'],['Chemical Science','2041-6539'],['JCTC','1549-9618']
].map(([name,issn])=>({name,issn}));
export const discoveryJournal=issn=>DISCOVERY_JOURNALS.find(j=>j.issn===issn);
const DAY=86400000,clean=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
export function dateDay(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('请选择完整的起止日期。');const t=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error('日期无效。');return t/DAY;}
export const dayDate=n=>new Date(n*DAY).toISOString().slice(0,10);
export function validateDiscoveryQuery(value){
 if(!value||typeof value!=='object')throw Error('检索条件无效。');
 const from=String(value.from||''),until=String(value.until||''),start=dateDay(from),end=dateDay(until);
 if(start>end||end-start>365)throw Error('每次请选择一年以内的日期范围，开始日期不能晚于结束日期。');
 const journals=[...new Set(Array.isArray(value.journals)?value.journals:[])];if(!journals.length||journals.length>DISCOVERY_JOURNALS.length||journals.some(x=>!discoveryJournal(x)))throw Error('请选择有效期刊，可同时选择多本。');
 const threshold=Number(value.threshold);if(!Number.isInteger(threshold)||threshold<0||threshold>10)throw Error('收录门槛须为0–10之间的整数。');
 const profile=String(value.profile||'').trim();if(profile.length<10||profile.length>2000)throw Error('研究方向请填写10–2000字。');
 return {from,until,journals,threshold,profile};
}
export function discoveryScope(query,issn){return JSON.stringify([DISCOVERY_RULE,issn,query.threshold,clean(query.profile).toLowerCase()]);}
export function uncoveredDiscoveryRanges(query,history,issn){
 const scope=discoveryScope(query,issn),start=dateDay(query.from),end=dateDay(query.until);
 const covered=history.filter(h=>h.status==='completed'&&h.scope===scope).map(h=>[Math.max(start,dateDay(h.from)),Math.min(end,dateDay(h.until))]).filter(([a,b])=>a<=b).sort((a,b)=>a[0]-b[0]);
 let cursor=start;const gaps=[];for(const [a,b] of covered){if(a>cursor)gaps.push({from:dayDate(cursor),until:dayDate(a-1)});cursor=Math.max(cursor,b+1);if(cursor>end)break;}if(cursor<=end)gaps.push({from:dayDate(cursor),until:dayDate(end)});return gaps;
}
export function discoveryPlan(query,history=[]){return query.journals.flatMap(issn=>uncoveredDiscoveryRanges(query,history,issn).map(range=>({...range,issn,scope:discoveryScope(query,issn)})));}
export function textFromMetadata(value=''){
 return String(value).replace(/<\/?(?:p|div|br|jats:p|jats:title|title)\b[^>]*>/gi,' ').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[x])).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';}).replace(/\s+/g,' ').trim();
}
export function crossrefEntry(item,issn){
 const doi=normalizeDOI(item?.DOI),titleEn=textFromMetadata(item?.title?.[0]||'').slice(0,700);if(!doi||!titleEn)return null;
 const dateFields=['published','published-online','published-print','issued'],field=dateFields.find(k=>Array.isArray(item[k]?.['date-parts']?.[0])&&item[k]['date-parts'][0].length>=1),parts=field?item[field]['date-parts'][0]:[],date=parts.map((x,i)=>String(x).padStart(i?2:4,'0')).join('-');
 const abstract=textFromMetadata(item.abstract||'').slice(0,5000);
 return {doi,titleEn,journal:discoveryJournal(issn)?.name||textFromMetadata(item['container-title']?.[0]),issn,publishedDate:/^\d{4}(?:-\d{2}){0,2}$/.test(date)?date:'',dateSource:field||'',authors:(item.author||[]).slice(0,6).map(a=>clean([a.given,a.family].filter(Boolean).join(' '))).filter(Boolean),abstract,url:'https://doi.org/'+doi,evidence:abstract?'title-and-abstract':'title-only'};
}
export function highScoreEntries(existing,incoming,{threshold,profile,at=new Date().toISOString()}={}){
 const map=new Map(existing.map(p=>[normalizeDOI(p.doi),p]).filter(([id])=>id));let added=0;
 for(const p of incoming){const doi=normalizeDOI(p.doi);if(!doi||!Number.isInteger(p.score)||p.score<threshold||p.score>10||p.isRelevant===false)continue;const old=map.get(doi);if(!old)added++;map.set(doi,{...p,...(old?.studyTypeEdited?{studyType:old.studyType,studyTypeEdited:true}:{}),doi,url:'https://doi.org/'+doi,profile,retainedAt:at,retentionThreshold:threshold});}
 return {entries:[...map.values()].sort((a,b)=>b.score-a.score||(b.publishedDate||'').localeCompare(a.publishedDate||'')),added};
}
export function isDiscoveryCollected(entry,papers=[]){
 const doi=normalizeDOI(entry.doi),title=normalizePaperTitle(entry.titleEn);
 return papers.some(p=>{const identity=paperIdentity(p);return doi&&doi===identity.doi||title.length>=30&&title===identity.titleKey;});
}
export function newDiscoveryEntries(entries,saved=[],papers=[]){const seen=new Set(saved.map(p=>normalizeDOI(p.doi)));return entries.filter(p=>{const doi=normalizeDOI(p.doi);if(!doi||seen.has(doi)||isDiscoveryCollected(p,papers))return false;seen.add(doi);return true;});}
export const DISCOVERY_TYPES=['实验','纯计算','待分类'];
export function discoveryStudyType(p){
 if(p.studyTypeEdited&&DISCOVERY_TYPES.includes(p.studyType))return p.studyType;
 if(['实验','纯计算'].includes(p.studyType))return p.studyType;
 const s=[p.titleEn,p.titleZh,p.abstract].filter(Boolean).join(' ');
 if(/\bwe (?:synthesi[sz]\w*|fabricat\w*|measur\w*|characteri[sz]\w*)\b/i.test(s))return '实验';
 // Lightweight first pass: original experiments (including mixed studies) win.
 if(/\b(?:synthesi[sz]\w*|fabricat\w*|experiment\w*|measur\w*|spectroscop\w*|characteri[sz]\w*|in situ|operando|electrode|catalyst)\b/i.test(s)&&!/\b(?:DFT|density.functional|molecular dynamics|first.principles|ab initio|theoretical|computational|simulation)\b/i.test(p.titleEn||'')||/实验|制备|合成|表征|原位|催化剂/.test(s)&&!/理论|模拟|计算/.test(p.titleZh||''))return '实验';
 if(/\b(?:DFT|density.functional|molecular dynamics|first.principles|ab initio|theoretical|computational|simulation|machine.learning|neural network|deep learning|foundation model)\b/i.test(s)||/密度泛函|分子动力学|第一性原理|机器学习|神经网络|理论|模拟|计算/.test(s))return '纯计算';
 return '实验';
}
export const DISCOVERY_SORTS={'date-desc':'发表时间：从新到旧','date-asc':'发表时间：从旧到新','score-desc':'分数：从高到低','score-asc':'分数：从低到高'};
export function sortDiscoveryEntries(entries,sort='score-desc'){
 const date=p=>/^\d{4}(?:-\d{2}){0,2}$/.test(p.publishedDate||'')?(p.publishedDate+'-01-01').slice(0,10):'';
 const byDate=(a,b,direction)=>{const x=date(a),y=date(b);return !x||!y?x?-1:y?1:0:direction*x.localeCompare(y);};
 return [...entries].sort((a,b)=>(sort.startsWith('date-')?byDate(a,b,sort==='date-asc'?1:-1)||b.score-a.score:(sort==='score-asc'?a.score-b.score:b.score-a.score)||byDate(a,b,-1))||a.doi.localeCompare(b.doi));
}
export function discoveryBackup(value){
 if(!value||value.version!==DISCOVERY_VERSION||!Array.isArray(value.entries)||!Array.isArray(value.history)||value.entries.length>10000||value.history.length>3000)throw Error('备份格式无效，最多支持10000条题录和3000条检索记录。');
 const entries=value.entries.map(p=>{
  if(!p||!normalizeDOI(p.doi)||!Number.isInteger(p.score)||p.score<0||p.score>10||typeof p.titleEn!=='string'||!p.titleEn.trim())throw Error('题录中存在无效的DOI、分数或标题。');
  const str=(k,n=2000)=>String(p[k]||'').slice(0,n);return {doi:normalizeDOI(p.doi),titleEn:str('titleEn',700),titleZh:str('titleZh',700),journal:str('journal',200),issn:str('issn',20),publishedDate:str('publishedDate',10),authors:Array.isArray(p.authors)?p.authors.slice(0,6).map(x=>String(x).slice(0,120)):[],abstract:str('abstract',5000),reason:str('reason',700),studyType:discoveryStudyType(p),studyTypeEdited:p.studyTypeEdited===true,score:p.score,isRelevant:true,evidence:p.evidence==='title-and-abstract'?'title-and-abstract':'title-only',profile:str('profile'),retainedAt:str('retainedAt',40),retentionThreshold:Number.isInteger(p.retentionThreshold)&&p.retentionThreshold>=0&&p.retentionThreshold<=10?p.retentionThreshold:8,url:'https://doi.org/'+normalizeDOI(p.doi)};
 });
 const history=value.history.map(h=>{if(!h||!discoveryJournal(h.issn)||!['completed','interrupted','failed'].includes(h.status)||typeof h.scope!=='string'||h.scope.length>2300)throw Error('检索历史无效。');if(dateDay(h.from)>dateDay(h.until))throw Error('历史日期无效。');return {id:clean(h.id).slice(0,100),issn:h.issn,from:h.from,until:h.until,scope:h.scope,status:h.status,at:clean(h.at).slice(0,40),screened:Math.max(0,Number(h.screened)||0),kept:Math.max(0,Number(h.kept)||0)};});
 return {version:DISCOVERY_VERSION,entries,history};
}
export function discoveryCSV(entries){const cells=['日期','期刊','中文标题','原文标题','相关性分数','文章类型','评分理由','DOI','原文入口'],rows=entries.map(p=>[p.publishedDate,p.journal,p.titleZh,p.titleEn,p.score,discoveryStudyType(p),p.reason,p.doi,p.url]);return '\uFEFF'+[cells,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+@\-]/,'\t$&').replaceAll('"','""')+'"').join(',')).join('\r\n');}
export function figureJournalFacets(figures,papers){const byId=new Map(papers.map(p=>[p.id,p])),counts=new Map();for(const f of new Map(figures.map(f=>[f.id,f])).values()){const journal=clean(byId.get(f.paperId)?.journal)||'期刊待核实';counts.set(journal,(counts.get(journal)||0)+1);}return [...counts].map(([journal,count])=>({journal,count})).sort((a,b)=>a.journal.localeCompare(b.journal));}
export function filterFiguresByJournal(figures,papers,journal){if(!journal)return figures;const byId=new Map(papers.map(p=>[p.id,p]));return figures.filter(f=>(clean(byId.get(f.paperId)?.journal)||'期刊待核实')===journal);}
