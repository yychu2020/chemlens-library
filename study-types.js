export const STUDY_TYPES=['纯计算','实验'];
// Reviewed against each paper's methods; comparisons with published experimental
// data alone do not make a computational study an experimental one.
const curated={
 'example-furfural-cu':'实验','glad-paper':'纯计算','heenen-paper':'纯计算',
 'zn-glad-paper':'实验','rh-mfi-paper':'实验','toluene-paper':'纯计算',
 'mesopore-paper':'实验','network-paper':'纯计算','alkali-paper':'纯计算',
 'dynamic-co-paper':'实验','clam-paper':'纯计算','ptfe-paper':'实验',
 'nmi-paper':'纯计算','robot-paper':'实验','catda-paper':'纯计算',
 'oer-paper':'实验','crystalx-paper':'实验','au-cations-paper':'纯计算',
 'ruo2-water-paper':'纯计算','pinn-battery-paper':'实验'
};
export function paperStudyType(p){const chosen=p?.studyType||p?.analysis?.studyType;return STUDY_TYPES.includes(chosen)?chosen:curated[p?.resolvedPaperId||p?.id]||'待分类';}
export function filterStudyType(papers,type){return STUDY_TYPES.includes(type)?papers.filter(p=>paperStudyType(p)===type):papers;}
