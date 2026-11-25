/** Drawing-style tags: equivalent aliases normalize to one label; broad families improve matching. */
export const TAG_TAXONOMY = [
  {tag:'流程图',aliases:['工作流程','工作流','流程示意','workflow','flowchart']},
  {tag:'结构模型',aliases:['结构图','结构示意','结构示意图','结构模型图','原子结构','structure model']},
  {tag:'球棍结构',aliases:['球棍图','球棍模型','球棍结构图','ball-and-stick','ball stick']},
  {tag:'能量图',aliases:['能量曲线','能量剖面','energy diagram','energy profile']},
  {tag:'自由能图',aliases:['自由能路径','自由能阶梯','自由能剖面','自由能曲线','free energy','gibbs diagram']},
  {tag:'能垒图',aliases:['活化能图','过渡态能垒','势垒图','barrier diagram']},
  {tag:'反应路径',aliases:['反应路线','反应路径图','反应坐标图','reaction path','reaction coordinate']},
  {tag:'反应网络',aliases:['反应网络图','reaction network','network diagram']},
  {tag:'折线图',aliases:['线图','曲线图','曲线对比图','line plot','line chart']},
  {tag:'散点图',aliases:['散点','scatter','scatter plot']},
  {tag:'拟合对比',aliases:['拟合图','预测对比','拟合对比图','parity plot','parity']},
  {tag:'柱状图',aliases:['柱形图','条形图','bar plot','bar chart']},
  {tag:'分布图',aliases:['直方图','统计分布','histogram','distribution']},
  {tag:'热图',aliases:['矩阵热图','heatmap','heat map']},
  {tag:'光谱图',aliases:['谱图','拉曼光谱','红外光谱','raman','ftir','spectrum']},
  {tag:'态密度图',aliases:['态密度','pdos','dos','density of states']},
  {tag:'电荷等值面',aliases:['等值面图','差分电荷密度图','电荷密度差','charge density','isosurface']},
  {tag:'显微图',aliases:['显微结构','电镜图','sem','tem','stem','microscopy']},
  {tag:'多面板组合',aliases:['多面板组合图','多面板','组合图','分图','多图拼接','multi-panel']},
  {tag:'对比组图',aliases:['对照图','对照组图','对比图','comparison']},
  {tag:'学习曲线',aliases:['误差收敛','训练曲线','learning curve']},
  {tag:'时间序列',aliases:['轨迹图','时间轨迹','time series','trajectory']},
];
const fold=value=>value.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g,'');
const aliases=new Map();
for(const item of TAG_TAXONOMY)for(const label of [item.tag,...item.aliases])aliases.set(fold(label),item.tag);
const clean=value=>value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/^#+\s*/,'').replace(/\s+/g,' ').slice(0,32);
export function normalizeTags(input){
  const values=typeof input==='string'?input.split(/[,，;；、\n]+/):Array.isArray(input)?input:[];
  const tags=[];const seen=new Set();
  for(const value of values){
    if(typeof value!=='string')continue;
    const label=clean(value);if(!label)continue;
    const tag=aliases.get(fold(label))||label;const key=fold(tag);
    if(!seen.has(key)){seen.add(key);tags.push(tag);}
    if(tags.length>=24)break;
  }
  return tags;
}
function legacyTags(figure){
  const text=[figure.category,figure.title,figure.description,figure.method].filter(x=>typeof x==='string').join(' ');
  const found=[];
  if(/自由能/.test(text))found.push('自由能图');
  else if(/能垒|过渡态|NEB/i.test(text))found.push('能垒图');
  else if(/自由能与路径|能量|势能面/.test(text))found.push('能量图');
  if(/反应路径|自由能与路径/.test(text))found.push('反应路径');
  if(/流程|工作流/.test(text))found.push('流程图');
  if(/结构模型|球棍|表面模型/.test(text))found.push('结构模型');
  if(/球棍/.test(text))found.push('球棍结构');
  if(/态密度|\bPDOS\b|\bDOS\b/i.test(text))found.push('态密度图');
  if(/电荷分析|电荷密度|等值面/.test(text))found.push('电荷等值面');
  if(/光谱|谱图|拉曼|红外/.test(text))found.push('光谱图');
  if(/显微|电镜|\bSEM\b|\bTEM\b/i.test(text))found.push('显微图');
  if(/散点/.test(text))found.push('散点图');
  if(/拟合|预测对比/.test(text))found.push('拟合对比');
  if(/学习曲线|训练误差/.test(text))found.push('学习曲线');
  if(/分子动力学|时间序列|温度轨迹/.test(text))found.push('时间序列','折线图');
  return normalizeTags(found);
}
const parents={'自由能图':['能量图','反应路径'],'能垒图':['能量图','反应路径'],'球棍结构':['结构模型'],'学习曲线':['折线图'],'拟合对比':['散点图']};
export function getFigureTags(figure={}){
  const own=Array.isArray(figure.tags)?normalizeTags(figure.tags):legacyTags(figure);
  return figure.tagsEdited?own:normalizeTags([...own,...own.flatMap(tag=>parents[tag]||[])]);
}
export function tagMatchesQuery(tag,query=''){
  if(!query.trim())return true;
  const q=fold(query.trim());const canonical=normalizeTags([tag])[0]||'';
  const taxonomy=TAG_TAXONOMY.find(item=>item.tag===canonical);
  return [canonical,...(taxonomy?.aliases||[])].some(label=>fold(label).includes(q));
}
export function figureTagSearchText(figure){
  return getFigureTags(figure).flatMap(tag=>{const item=TAG_TAXONOMY.find(x=>x.tag===tag);return [tag,...(item?.aliases||[])];}).join(' ');
}
function uniqueFigures(figures){const seen=new Set();return figures.filter(figure=>{const key=figure.id||figure;if(seen.has(key))return false;seen.add(key);return true;});}
export function countTags(figures=[]){
  const counts=new Map();
  for(const figure of uniqueFigures(figures))for(const tag of getFigureTags(figure))counts.set(tag,(counts.get(tag)||0)+1);
  return [...counts].map(([tag,count])=>({tag,count})).sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag,'zh-CN'));
}
export function matchScore(figure,selected=[]){const tags=new Set(getFigureTags(figure));return normalizeTags(selected).filter(tag=>tags.has(tag)).length;}
export function filterByTags(figures=[],selected=[],mode='any'){
  const selectedTags=normalizeTags(selected);
  return uniqueFigures(figures).filter(figure=>!selectedTags.length||(mode==='all'?matchScore(figure,selectedTags)===selectedTags.length:matchScore(figure,selectedTags)>0));
}

const pinyinCollator=new Intl.Collator('zh-CN-u-co-pinyin',{sensitivity:'base'});
const initials=[['A','阿'],['B','八'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','趴'],['Q','期'],['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],['Y','压'],['Z','匝']];
export function tagInitial(tag){const first=String(tag||'').normalize('NFKC').trim()[0]||'';if(/[a-z]/i.test(first))return first.toUpperCase();if(!/\p{Script=Han}/u.test(first))return '#';let initial='A';for(const [letter,boundary]of initials){if(pinyinCollator.compare(first,boundary)<0)break;initial=letter;}return initial;}
export function sortTagChoices(choices,order='count',initial=''){return choices.filter(x=>!initial||tagInitial(x.tag)===initial).sort((a,b)=>order==='pinyin'?tagInitial(a.tag).localeCompare(tagInitial(b.tag))||pinyinCollator.compare(a.tag,b.tag):b.count-a.count||pinyinCollator.compare(a.tag,b.tag));}
