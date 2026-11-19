import {paperDisplayName} from './paper-names.js';
// Figure identity and paper provenance are formatted at display time.
export function figureDisplayTitle(figure = {}) {
 const raw = String(figure.title || '').trim();
 const prefix = /^(?:图\s*[A-Za-z]?\d+[a-z]?(?:[–-]\d+[a-z]?)?|(?:Fig(?:ure)?\.?|Extended Data Fig\.?)\s*[A-Za-z]?\d+[a-z]?)\s*[|｜:：]\s*/i;
 const title = raw.replace(prefix, '').trim();
 const number = String(figure.number || '').trim().replace(/^(?:图|Fig(?:ure)?\.?|Extended Data Fig\.?)\s*/i, '').trim();
 return number ? `图 ${number}｜${title}` : raw;
}
export function figurePaperSource(paper = {}) {return paperDisplayName(paper);}
