export const GALLERY_PAGE_SIZE=100;
export function figureStars(value){return Number.isFinite(value)&&value>=0&&value<=5?value:0;}
export function paginateFigures(figures,page=1){const total=figures.length,pages=Math.max(1,Math.ceil(total/GALLERY_PAGE_SIZE)),current=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1)),offset=(current-1)*GALLERY_PAGE_SIZE;return {items:figures.slice(offset,offset+GALLERY_PAGE_SIZE),page:current,pages,total,start:total?offset+1:0,end:Math.min(offset+GALLERY_PAGE_SIZE,total)};}
export function sortFiguresByStars(figures,getRating=f=>f.rating){return [...figures].sort((a,b)=>figureStars(getRating(b))-figureStars(getRating(a)));}

export function formatFigureStars(value){const stars=figureStars(value);return String(stars===5?5:Math.min(4.99,Math.round(stars*100)/100));}

export function figureRatingTone(value){const n=figureStars(value),index=n===0?0:Math.max(1,Math.min(5,Math.round(n))),colors=['#95A4B8','#D55069','#D58138','#AF932D','#269D87','#16855B'];return {color:colors[index],highlight:n>=3,tier:index};}
export function figureNavigation(ids,current){const unique=[...new Set(ids)],index=unique.indexOf(current);return {index,total:unique.length,previous:index>0?unique[index-1]:null,next:index>=0&&index+1<unique.length?unique[index+1]:null};}
