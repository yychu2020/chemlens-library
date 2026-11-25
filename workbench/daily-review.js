import {discoveryStudyType} from './paper-discovery.js';
export const reviewDay=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
export function recentReviewDays(today=reviewDay()){
 const stamp=Date.parse(today+'T00:00:00Z');if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==today)throw Error('日报日期无效。');
 return Array.from({length:7},(_,i)=>new Date(stamp-i*86400000).toISOString().slice(0,10));
}
export function reviewForDays(entries,selected=[reviewDay()],{today=reviewDay()}={}){
 const allowed=recentReviewDays(today);if(!Array.isArray(selected)||selected.some(d=>!allowed.includes(d)))throw Error('请选择最近7天内的筛选日期。');
 const dates=[...new Set(selected)].sort(),date=dates.length===1?dates[0]:today,period=dates.length===1?date:'所选'+dates.length+'天',title=dates.length===1?date+' 高相关文献日报':today+' 自选'+dates.length+'日文献汇总';
 const day=value=>{try{return value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(value)):'';}catch{return '';}};
 const seen=new Set(),papers=entries.filter(p=>p.score>8&&dates.includes(day(p.retainedAt))&&!seen.has(p.doi)&&seen.add(p.doi)).sort((a,b)=>b.score-a.score||a.doi.localeCompare(b.doi));
 const groups=[['计算文章',papers.filter(p=>discoveryStudyType(p)==='纯计算')],['实验文章',papers.filter(p=>discoveryStudyType(p)!=='纯计算')]],blocks=[{type:'heading',level:1,text:title},{type:'paragraph',text:papers.length?`${period}筛选发现${papers.length}篇9–10分高相关文献，其中计算文章${groups[0][1].length}篇、实验文章${groups[1][1].length}篇。以下按题名、摘要与相关性评分理由整理，供review。`:dates.length?'所选日期尚未筛出9–10分高相关文献。完成筛选后，这里会自动更新。':'请至少选择一个筛选日期。'}];
 if(dates.length)blocks.push({type:'paragraph',text:'统计筛选收录日期：'+dates.join('、')+'（北京时间）；同一DOI只计一次。'});
 for(const [title,list]of groups)if(list.length){blocks.push({type:'heading',level:2,text:title});for(const p of list)blocks.push({type:'heading',level:3,text:(p.journal||'')+' | '+(p.titleZh||p.titleEn)},{type:'paragraph',text:`相关性${p.score}/10。${p.reason||'请结合原文判断可借鉴之处。'}`},{type:'paragraph',text:'发表日期：'+(p.publishedDate||'待核实')+'；DOI：'+p.doi});}
 if(papers.length)blocks.push({type:'paragraph',text:'建议优先查看与当前反应、材料或方法直接相关的工作，再对照原文记录可迁移的思路。此日报仅据检索题录与初筛结果生成，未将摘要判断视为全文结论。'});
 return {date,dates,papers,blocks,title,digest:`${period}${papers.length}篇高相关文献，计算${groups[0][1].length}篇、实验${groups[1][1].length}篇。`,dailyReview:true};
}
export const dailyReview=(entries,date=reviewDay())=>reviewForDays(entries,[date],{today:date});
