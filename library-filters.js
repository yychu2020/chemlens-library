/** Clickable paper taxonomy. Missing metadata remains an explicit, selectable sublist. */
const clean=value=>typeof value==='string'||typeof value==='number'?String(value).normalize('NFKC').trim().replace(/\s+/g,' '):'';
export function normalizeResearchFields(input){
 const values=Array.isArray(input)?input:typeof input==='string'?input.split(/[,，;；、\n]+/):[];
 const seen=new Set(),result=[];
 for(const value of values){if(typeof value!=='string')continue;const label=clean(value).slice(0,60);if(!label)continue;const key=label.toLowerCase();if(!seen.has(key)){seen.add(key);result.push(label);}if(result.length>=12)break;}
 return result;
}
export function getPaperTaxonomy(paper={}){
 const raw=clean(paper.year).replace(/年$/,'');
 return {year:/^\d{4}$/.test(raw)?raw:'年份待核实',journal:clean(paper.journal)||'期刊待核实',fields:normalizeResearchFields(paper.researchFields??paper.researchField).length?normalizeResearchFields(paper.researchFields??paper.researchField):['领域待分类']};
}
function unique(papers){const seen=new Set();return papers.filter(p=>{if(!p||typeof p!=='object')return false;const id=p.id||p;if(seen.has(id))return false;seen.add(id);return true;});}
export function filterPapers(papers=[],selection={}){
 const {year='',journal='',field=''}=selection;
 return unique(papers).filter(p=>{const t=getPaperTaxonomy(p);return (!year||t.year===String(year))&&(!journal||t.journal===journal)&&(!field||t.fields.includes(field));});
}
export function buildPaperFacets(papers=[],selection={}){
 const count=(items,dimension)=>{const counts=new Map();for(const p of items){const t=getPaperTaxonomy(p);for(const value of dimension==='field'?t.fields:[t[dimension]])counts.set(value,(counts.get(value)||0)+1);}return [...counts].map(([value,count])=>({value,count}));};
 const years=count(filterPapers(papers,{...selection,year:''}),'year').sort((a,b)=>/^\d{4}$/.test(a.value)&&/^\d{4}$/.test(b.value)?Number(b.value)-Number(a.value):/^\d{4}$/.test(a.value)?-1:/^\d{4}$/.test(b.value)?1:a.value.localeCompare(b.value,'zh-CN'));
 const journals=count(filterPapers(papers,{...selection,journal:''}),'journal').sort((a,b)=>a.value.localeCompare(b.value,'zh-CN'));
 const fields=count(filterPapers(papers,{...selection,field:''}),'field').sort((a,b)=>a.value.localeCompare(b.value,'zh-CN'));
 return {years,journals,fields};
}
