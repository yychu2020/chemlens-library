import {DISCOVERY_JOURNALS,dateDay,dayDate} from './paper-discovery.js';

// A paper can match more than one direction. These are sample statistics, not journal scope claims.
export const SEARCH_TOPICS=[
 ['电催化与电化学',/electrocatal|electrochem|electroly|oxygen reduction|oxygen evolution|co2 reduction|电催化|电化学/i],
 ['催化与反应机理',/catalys|catalyt|reaction mechan|reaction pathway|催化|反应机理/i],
 ['理论计算与模拟',/density functional|\bdft\b|molecular dynamics|simulation|computational|theoretical|量子|计算|模拟/i],
 ['机器学习与数据方法',/machine learning|deep learning|neural network|artificial intelligence|data.driven|机器学习|神经网络/i],
 ['能源与储能',/batter|supercapac|energy storage|fuel cell|hydrogen|photovolta|solar cell|电池|储能|氢能/i],
 ['材料结构与表征',/crystal|nanostruct|microscop|spectroscop|characterization|defect|interface|材料|晶体|表征|界面/i],
 ['合成与有机化学',/synthesis|synthetic|organic|polymer|合成|有机|聚合物/i],
 ['生物与环境',/protein|enzyme|biolog|biomed|pollut|environment|生物|环境|污染/i]
];
export function searchTopics(entry){const text=(entry.titleEn||'')+' '+(entry.abstract||'');const topics=SEARCH_TOPICS.filter(([,pattern])=>pattern.test(text)).map(([name])=>name);return topics.length?topics:['其他或信息不足'];}
export function mergeSearchRanges(ranges){const sorted=ranges.map(r=>({from:r.from,until:r.until})).sort((a,b)=>a.from.localeCompare(b.from)),out=[];for(const r of sorted){const last=out.at(-1);if(last&&dateDay(r.from)<=dateDay(last.until)+1)last.until=last.until>r.until?last.until:r.until;else out.push({...r});}return out;}
export function remainingSearchRanges(query,completed){let start=query.from;const out=[];for(const r of mergeSearchRanges(completed)){if(r.until<start||r.from>query.until)continue;if(r.from>start)out.push({from:start,until:dayDate(dateDay(r.from)-1)});start=dayDate(dateDay(r.until)+1);if(start>query.until)break;}if(start<=query.until)out.push({from:start,until:query.until});return out;}
export const reportTime=value=>{const d=new Date(value);return Number.isFinite(+d)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short',hour12:false}).format(d):'未记录';};
export const REPORT_STATUS={running:'进行中',paused:'已暂停',completed:'已完成',ended:'手动结束'};
export function searchReportView(record){const journals=record.query.journals.map(issn=>{const j=record.journals[issn]||{};return {issn,name:DISCOVERY_JOURNALS.find(x=>x.issn===issn)?.name||issn,retrieved:Object.keys(j.seen||{}).length,topics:Object.entries(j.topics||{}).sort((a,b)=>b[1]-a[1]),completed:mergeSearchRanges(j.completed||[]),remaining:remainingSearchRanges(record.query,j.completed||[])};}),batches=Object.values(record.batches||{});return {id:record.id,mode:record.mode,query:record.query,createdAt:record.createdAt,updatedAt:record.updatedAt,status:record.status,error:record.error||'',legacy:!!record.legacy,journals,retrieved:journals.reduce((n,j)=>n+j.retrieved,0),screened:batches.reduce((n,b)=>n+b.screened,0),retained:batches.reduce((n,b)=>n+b.retained,0),skipped:batches.reduce((n,b)=>n+b.skipped,0),pendingFailures:Object.keys(record.failures||{}).length,source:'Crossref',window:record.window||null};}
export function searchReportMarkdown(r){const ranges=rs=>rs.length?rs.map(x=>`${x.from} 至 ${x.until}`).join('；'):'无';return [`# 文献检索报告`,`${reportTime(r.createdAt)}（北京时间） · ${REPORT_STATUS[r.status]||r.status}`,`检索范围：${r.query.from} 至 ${r.query.until}；收录门槛：${r.query.threshold}/10。`,`研究方向：${r.query.profile}`,`获取 ${r.retrieved} 条题录；评分完成 ${r.screened} 条；达标 ${r.retained} 条；跳过已有题录 ${r.skipped} 条；待补评分 ${r.pendingFailures} 条。`,...(r.window?[`每日更新窗口（UTC）：${r.window.from} 至 ${r.window.until}`]:[]),...(r.legacy?['旧任务仅记录启用报告后的进度，较早进度未追溯。']:[]),...r.journals.flatMap(j=>[`## ${j.name}`,`本次获取 ${j.retrieved} 条；研究方向：${j.topics.map(([t,n])=>`${t} ${n}条`).join('、')||'尚无样本'}。`,`完整完成：${ranges(j.completed)}`,`未完整完成：${ranges(j.remaining)}`]),`方向统计基于本次获取题名与摘要的关键词匹配，同一论文可计入多个方向；不代表期刊整体定位。数据源：Crossref。`,...(r.error?[`当前提示：${r.error}`]:[])].join('\n\n');}
