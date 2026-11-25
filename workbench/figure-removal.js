import {figureKey} from './figure-geometry.js';
export const figureRemovalKey=f=>f?.paperId&&f?.number?f.paperId+'|'+figureKey(f.number):String(f?.id||'');
export const isFigureRemoved=(state,f)=>!!state.figureVisibility?.[figureRemovalKey(f)]?.removed;
export function mergeFigureVisibility(a={},b={}){const out={...a};for(const [key,value]of Object.entries(b)){const old=out[key];if(old?.pending&&old.mutationId!==value.mutationId)continue;if(!old||old.pending||String(value.updatedAt||'')>=String(old.updatedAt||''))out[key]=value;}return out;}
export function pendingFigureVisibility(records={}){return Object.values(records).filter(r=>r.pending===true);}
export function acknowledgeFigureVisibility(records,submitted,record){const key=figureRemovalKey(submitted);if(records[key]?.mutationId!==submitted.mutationId)return records;return {...records,[key]:{...record,pending:false}};}
