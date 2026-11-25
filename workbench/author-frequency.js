// Match the stored full name exactly: no case folding, trimming, initials or alias merging.
export function authorFrequency(papers,{minimum=3}={}){
 const authors=new Map(),seenPapers=new Set();
 for(const paper of papers){
  if(!paper||typeof paper.id!=='string'||seenPapers.has(paper.id))continue;
  seenPapers.add(paper.id);
  for(const name of new Set(Array.isArray(paper.authors)?paper.authors:[])){
   if(typeof name!=='string'||!name.trim())continue;
   if(!authors.has(name))authors.set(name,{name,paperIds:[]});
   authors.get(name).paperIds.push(paper.id);
  }
 }
 return [...authors.values()].filter(a=>a.paperIds.length>=minimum).map(a=>({...a,count:a.paperIds.length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-CN')||a.name.localeCompare(b.name));
}
export function papersByExactAuthor(papers,name){return papers.filter(p=>Array.isArray(p.authors)&&p.authors.includes(name));}
