export const GALLERY_PAGE_SIZE=100;
export function figureStars(value){return Number.isFinite(value)&&value>=0&&value<=5?value:0;}
export function paginateFigures(figures,page=1){const total=figures.length,pages=Math.max(1,Math.ceil(total/GALLERY_PAGE_SIZE)),current=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1)),offset=(current-1)*GALLERY_PAGE_SIZE;return {items:figures.slice(offset,offset+GALLERY_PAGE_SIZE),page:current,pages,total,start:total?offset+1:0,end:Math.min(offset+GALLERY_PAGE_SIZE,total)};}
export function sortFiguresByStars(figures,getRating=f=>f.rating){return [...figures].sort((a,b)=>figureStars(getRating(b))-figureStars(getRating(a)));}

export function formatFigureStars(value){const stars=figureStars(value);return String(stars===5?5:Math.min(4.99,Math.round(stars*100)/100));}
