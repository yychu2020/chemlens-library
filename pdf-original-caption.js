import {figureKey} from './figure-geometry.js';
// Text only: reading an original caption must not render or recrop the PDF.
export function originalCaptionFromPage(content,viewport,number){
 const rows=[];for(const item of content.items||[]){if(!item.str?.trim()||!item.transform)continue;const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]),h=Math.abs(item.height||item.transform[3]||8);let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,h*.25));if(!row){row={y,items:[]};rows.push(row);}row.items.push({text:item.str,x,w:Math.abs(item.width||0),h});}
 rows.sort((a,b)=>a.y-b.y);for(const row of rows)row.items.sort((a,b)=>a.x-b.x);
 const wanted=figureKey(number),pattern=/^(?:(?:Supplementary|Extended Data)\s+)?(?:Fig(?:ure)?\.?)\s*(S?\d+[a-z]?)\b\s*[.:|｜]?\s*/i;
 for(let i=0;i<rows.length;i++){const row=rows[i],text=row.items.map(x=>x.text).join(' ').trim(),match=pattern.exec(text);if(!match||figureKey(match[1])!==wanted)continue;
  const left=row.items[0].x,h=Math.max(...row.items.map(x=>x.h)),right=Math.max(...row.items.map(x=>x.x+x.w)),columnEnd=right>viewport.width*.58?viewport.width:left<viewport.width*.5?viewport.width*.53:viewport.width;
  const parts=[text];let previous=row.y;for(let j=i+1;j<rows.length;j++){const next=rows[j],items=next.items.filter(x=>x.x>=left-12&&x.x<columnEnd);if(!items.length)continue;const line=items.map(x=>x.text).join(' ').trim(),height=Math.max(...items.map(x=>x.h));if(next.y-previous>h*2.5||height>h*1.35||pattern.test(line)||/^(?:References|Methods|Results|Discussion|Acknowledg|Supporting Information)\b/i.test(line))break;parts.push(line);previous=next.y;if(parts.join(' ').length>12000)break;}
  const caption=parts.join(' ').replace(/\s+/g,' ').trim();if(/[A-Za-z]{3}/.test(caption))return caption;
 }
 return '';
}
