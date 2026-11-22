const sub=Object.fromEntries([...'0123456789+-−=()'].map((c,i)=>[c,[...'₀₁₂₃₄₅₆₇₈₉₊₋₋₌₍₎'][i]]));
const sup=Object.fromEntries([...'0123456789+-−=()'].map((c,i)=>[c,[...'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁼⁽⁾'][i]]));
const symbols=new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu'.split(' '));
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=(s,map)=>[...s].map(c=>map[c]??c).join('');
export function scientificText(value){let s=String(value??'');
 s=s.replace(/\\(?:mathrm|text|operatorname)\{([^{}]*)\}/g,'$1').replace(/\\(times|cdot|pm|Delta|alpha|beta|gamma|mu|nu|theta|eta|epsilon|sigma|phi|Omega|angstrom)\b/g,(_,k)=>({times:'×',cdot:'·',pm:'±',Delta:'Δ',alpha:'α',beta:'β',gamma:'γ',mu:'μ',nu:'ν',theta:'θ',eta:'η',epsilon:'ε',sigma:'σ',phi:'φ',Omega:'Ω',angstrom:'Å'}[k])).replace(/\$([^$\n]+)\$/g,'$1');
 s=s.replace(/\b(cm|mm|nm|m|Å|mol|kg|g|ps|ns|s|eV|V|K|e)([−-][1-9]\d*|[²³])/g,(_,u,n)=>u+digits(n,sup));
 s=s.replace(/\b(cm|mm|nm|m|Å)2\b/g,'$1²').replace(/\b(cm|mm|nm|m|Å)3\b/g,'$1³');
 s=s.replace(/\b([A-Z][a-z]?)([1-9]\d*)([+−-])(?=$|[^A-Za-z0-9])/g,(all,atom,n,charge)=>symbols.has(atom)?atom+digits(n+charge,sup):all);
 s=s.replace(/\b(Cu|Ni|Fe|Co|Mn|Ru|Pt|Pd|Au|Ag)0\b/g,'$1⁰');
 s=s.replace(/\b(?:[A-Z][a-z]?\d*){1,12}\b/g,token=>{
  if(!/\d/.test(token)||/^(?:COF|ZIF|MOF|OC)\d/.test(token))return token;
  const atoms=[...token.matchAll(/([A-Z][a-z]?)(\d*)/g)];if(atoms.map(x=>x[0]).join('')!==token||atoms.some(x=>!symbols.has(x[1])))return token;
  if(atoms.length===1&&!/^(?:H2|O2|N2|F2|Cl2|Br2|I2|S8)$/.test(token))return token;
  return atoms.map(([,atom,n])=>atom+digits(n,sub)).join('');
 });
 s=s.replace(/(\b(?:M|Fe|Co|Ni|Cu|Mn)[–−-]N)([1-4])(?=[–−-]C\b)/g,(_,a,n)=>a+digits(n,sub));
 s=s.replace(/\b(H|Na|K|Li|Cu|Ag|OH|HOO|e)([+−-])(?=$|[\s,，;；)）/])/g,(_,a,c)=>a+digits(c,sup));return s;
}
function segments(value){const s=scientificText(value),out=[];let at=0;const re=/<(sub|sup)>([^<>]{1,100})<\/\1>|([_^])\{([^{}]{1,100})\}|([_^])([+−-]?\d+(?:[+−-])?|[A-Za-z])/g;for(const m of s.matchAll(re)){if(m.index>at)out.push({text:s.slice(at,m.index)});out.push({type:m[1]||((m[3]||m[5])==='_'?'sub':'sup'),text:m[2]||m[4]||m[6]});at=m.index+m[0].length;}if(at<s.length)out.push({text:s.slice(at)});return out;}
export function scientificHTML(value){return segments(value).map(s=>s.type?`<${s.type} style="font-size:75%;line-height:0;vertical-align:${s.type==='sub'?'sub':'super'};">${escape(s.text)}</${s.type}>`:escape(s.text)).join('');}
export function scientificMarkdown(value){return segments(value).map(s=>s.type?`<${s.type}>${escape(s.text)}</${s.type}>`:s.text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\[\]])/g,'\\$1')).join('');}
export function scientificPlainText(value){return segments(value).map(s=>{if(!s.type)return s.text;const map=s.type==='sub'?sub:sup;return [...s.text].every(c=>c in map)?digits(s.text,map):(s.type==='sub'?'_':'^')+'('+s.text+')';}).join('');}
