// Shared deterministic naming. Full original titles remain separate metadata.
const journals=[
 ['Journal of the American Chemical Society','JACS',['Journal of the American Chemical Society','J. Am. Chem. Soc.','JACS']],
 ['Angewandte Chemie International Edition','Angew. Chem. Int. Ed.',['Angewandte Chemie International Edition','Angew. Chem. Int. Ed.','Angew']],
 ['Nature Communications','Nature Communications',['Nature Communications']],
 ['Nature Catalysis','Nature Catalysis',['Nature Catalysis','Nat. Catal.','Nat Cat']],
 ['Nature Machine Intelligence','Nature Machine Intelligence',['Nature Machine Intelligence']],
 ['npj Computational Materials','npj Computational Materials',['npj Computational Materials']],
 ['ACS Catalysis','ACS Catalysis',['ACS Catalysis','ACS Catal.','ACS Cat']],
 ['JACS Au','JACS Au',['JACS Au']],['Chemical Science','Chemical Science',['Chemical Science','Chem. Sci.','ChemSci']],['Science','Science',['Science']]
];
const aliases=journals.flatMap(([full,display,list])=>list.map(alias=>({full,display,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
const text=value=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' '):'';
function journalMatch(value){const lower=value.toLowerCase();return aliases.find(j=>lower===j.alias.toLowerCase());}
function legacySource(raw){const prefix=raw.slice(0,110).toLowerCase();return aliases.map(j=>({...j,index:prefix.indexOf(j.alias.toLowerCase())})).filter(j=>j.index>=0&&j.index<35).sort((a,b)=>a.index-b.index||b.alias.length-a.alias.length)[0];}
export function paperJournalName(p={}){const value=text(p.journal);if(value)return journalMatch(value)?.display||value;const found=legacySource(text(p.title||p.filename));return found?.display||'期刊待核实';}
export function cleanPaperShortTitle(value,p={}){let title=text(value).replace(/\.pdf$/i,'');const startedWithYear=/^(?:19|20)\d{2}/.test(title);title=title.replace(/^(?:19|20)\d{2}\s*/,'');const found=legacySource(title);if(found&&(found.index===0||startedWithYear&&found.index<12))title=title.slice(found.index+found.alias.length);title=title.replace(/^[\s·|｜:：_–—-]+/,'').replace(/^(?:19|20)\d{2}\s*[·|｜:：_–—-]*\s*/,'').replace(/^[\s·|｜:：_–—-]+/,'');
 if(!/[\u3400-\u9fff]/u.test(title))return '中文短名待补充';
 const rules=[[/MACE/i,'比较MACE从头训练与微调'],[/卷积神经网络.*(?:阻抗|等效电路)|(?:阻抗|等效电路).*卷积神经网络/,'卷积神经网络识别阻抗等效电路'],[/(?:CLAM|局部微调).*(?:势|模型)|(?:势|模型).*局部微调/,'局部微调构建催化机器学习势'],[/碱金属.*(?:Cu\(?100|铜).*CO[₂2]|碱金属.*CO[₂2].*(?:Cu\(?100|铜)/,'碱金属调控酸性铜表面CO₂电还原']];
 if(title.length>30)for(const [pattern,short] of rules)if(pattern.test(title))return short;
 if(title.length>32){const main=title.split(/[：:；;。]/)[0];title=main||title;title=title.replace(/^(?:一种用于|一种|基于|通过)/,'');if(title.length>32)title=[...title].slice(0,32).join('');}
 return title||'中文短名待补充';}
export function paperShortName(p={}){for(const value of [p.shortTitle,p.short,p.chineseTitle,p.title,p.filename]){if(!value)continue;const result=cleanPaperShortTitle(value,p);if(result!=='中文短名待补充')return result;}return '中文短名待补充';}
export function paperDisplayName(p={}){const rawYear=text(String(p.year||'')),inferred=text(p.title||p.filename).match(/^((?:19|20)\d{2})/);const year=/^(?:19|20)\d{2}$/.test(rawYear)?rawYear:inferred?.[1]||'年份待核实';return `${year} ${paperJournalName(p)} ${paperShortName(p)}`;}
