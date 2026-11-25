const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
export function calendarDate(value){
 const s=String(value||'').trim().replace(/(\d)(?:st|nd|rd|th)\b/gi,'$1').replace(/,/g,' ');let y,m,d,a;
 if(a=s.match(/\b((?:19|20)\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/)){[,y,m,d]=a;}
 else if(a=s.match(/\b(\d{1,2})\s+([A-Za-z]+)\.?\s+((?:19|20)\d{2})/)){d=a[1];m=months[a[2].slice(0,3).toLowerCase()];y=a[3];}
 else if(a=s.match(/\b([A-Za-z]+)\.?\s+(\d{1,2})\s+((?:19|20)\d{2})/)){m=months[a[1].slice(0,3).toLowerCase()];d=a[2];y=a[3];}
 else if(a=s.match(/\b(\d{1,2})[/.](\d{1,2})[/.]((?:19|20)\d{2})/)){d=a[1];m=a[2];y=a[3];}
 if(!y||!m||!d)return '';const iso=[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');const stamp=Date.parse(iso+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===iso?iso:'';
}
export function publicationDateFromText(text){
 const s=String(text||'').replace(/\s+/g,' '),matches=[];
 const labels=/(published(?:\s+(?:online|in issue))?(?:\s+(?:on|date))?|publication date|first published|available online|accepted(?:\s+(?:on|date))?|received(?:\s+(?:on|date))?|发表日期|出版日期|接收日期|接受日期|收稿日期)\s*[:：]?\s*/gi;let m;
 while(m=labels.exec(s)){let date;try{date=calendarDate(s.slice(labels.lastIndex,labels.lastIndex+55).split(/accepted|received|published|接收|接受|收稿|发表|出版/i)[0]);}catch{}if(!date)continue;const label=m[1].toLowerCase(),kind=/accept|接收|接受/.test(label)?'accepted':/receiv|收稿/.test(label)?'received':'published';matches.push({publicationDate:date,dateKind:kind,dateSource:'pdf',rank:{published:0,accepted:1,received:2}[kind]});}
 const found=matches.sort((a,b)=>a.rank-b.rank)[0];if(!found)return null;delete found.rank;return found;
}
export function publicationDateLabel(p){if(!p?.publicationDate)return '发表日期待补充';return ({published:'发表',accepted:'接收',received:'收稿'}[p.dateKind]||'发表')+'：'+p.publicationDate;}
const abbreviations={'Nature Communications':'Nat. Commun.','Nature Chemistry':'Nat. Chem.','Nature Catalysis':'Nat. Catal.','Nature Energy':'Nat. Energy','Nature Materials':'Nat. Mater.','Nature Nanotechnology':'Nat. Nanotechnol.','Nature Synthesis':'Nat. Synth.','Nature Water':'Nat. Water','Nature Protocols':'Nat. Protoc.','Nature Machine Intelligence':'Nat. Mach. Intell.','Nature Computational Science':'Nat. Comput. Sci.','npj Computational Materials':'npj Comput. Mater.','Science Advances':'Sci. Adv.','Journal of the American Chemical Society':'JACS','J. Am. Chem. Soc.':'JACS','Angewandte Chemie':'Angew. Chem.','Angewandte Chemie International Edition':'Angew. Chem. Int. Ed.','ACS Catalysis':'ACS Catal.','Chemical Science':'Chem. Sci.','Journal of Chemical Theory and Computation':'JCTC','Energy & Environmental Science':'EES'};
export function journalAbbreviation(journal){return abbreviations[journal]||String(journal||'').trim();}
export const PAPER_DATE_SORTS={default:'默认顺序','date-desc':'发表／接收日期：从新到旧','date-asc':'发表／接收日期：从旧到新'};
export function sortLibraryPapers(papers,order='default'){
 if(!['date-desc','date-asc'].includes(order))return [...papers];
 const valid=p=>/^\d{4}-\d{2}-\d{2}$/.test(p.publicationDate||'')&&calendarDate(p.publicationDate)===p.publicationDate?p.publicationDate:'';
 return papers.map((p,index)=>({p,index,date:valid(p)})).sort((a,b)=>!a.date||!b.date?(a.date?-1:b.date?1:a.index-b.index):(order==='date-asc'?a.date.localeCompare(b.date):b.date.localeCompare(a.date))||a.index-b.index).map(x=>x.p);
}
