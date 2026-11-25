import {figureKey} from './figure-geometry.js';
export const figureRemovalKey=f=>f?.paperId&&f?.number?f.paperId+'|'+figureKey(f.number):String(f?.id||'');
export const isFigureRemoved=(state,f)=>!!state.figureVisibility?.[figureRemovalKey(f)]?.removed;
export function mergeFigureVisibility(a={},b={}){const out={...a};for(const [key,value]of Object.entries(b))if(!out[key]||String(value.updatedAt||'')>=String(out[key].updatedAt||''))out[key]=value;return out;}
