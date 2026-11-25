import {paperDisplayName} from './paper-names.js';
export const stripFigureTitle=value=>String(value||'').trim().replace(/^(?:图\s*[A-Za-z]?\d+[a-z]?(?:[–-]\d+[a-z]?)?|(?:Fig(?:ure)?\.?|Extended Data Fig\.?)\s*[A-Za-z]?\d+[a-z]?)\s*[|｜:：]\s*/i,'').trim();
export const hasChineseFigureTitle=value=>(stripFigureTitle(value).match(/[\u3400-\u9fff]/gu)||[]).length>=2;
const checkedTitles={
 'valorization process, techno-economic analysis, and ECR mechanisms of FUR-to-FA conversion':'糠醛转化为糠醇的利用过程、技术经济分析与电催化还原机理',
 'Theoretical predictions of the HAT-based ECR on Cu/ceria':'Cu/氧化铈上基于氢原子转移的电催化还原理论预测',
 'Structural and morphological characterizations':'结构与形貌表征',
 'ECR mechanistic investigations':'电催化还原机理研究',
 'ECR performance':'电催化还原性能',
 'Schematic plot of the ECR mechanism':'电催化还原机理示意图'
};
export function chineseFigureTitle(f={}){const title=stripFigureTitle(f.titleZh||f.title);if(hasChineseFigureTitle(title))return title;if(checkedTitles[title])return checkedTitles[title];const summary=[f.description,f.finding,f.question].find(hasChineseFigureTitle);return summary?String(summary).split(/[。\n]/)[0].slice(0,90):'原图内容与研究结果';}
// Figure identity and paper provenance are formatted at display time.
export function figureDisplayTitle(figure = {}) {
 const raw = String(figure.title || '').trim();
 const prefix = /^(?:图\s*[A-Za-z]?\d+[a-z]?(?:[–-]\d+[a-z]?)?|(?:Fig(?:ure)?\.?|Extended Data Fig\.?)\s*[A-Za-z]?\d+[a-z]?)\s*[|｜:：]\s*/i;
 const title = chineseFigureTitle(figure);
 const number = String(figure.number || '').trim().replace(/^(?:图|Fig(?:ure)?\.?|Extended Data Fig\.?)\s*/i, '').trim();
 return number ? `图 ${number}｜${title}` : raw;
}
export function figurePaperSource(paper = {}) {return paperDisplayName(paper);}
