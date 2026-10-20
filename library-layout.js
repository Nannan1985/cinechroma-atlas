/* Pure similarity/layout engine: browser worker + Node tests. */
(function(root){
'use strict';
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const clean=a=>Array.isArray(a)?a.filter(Boolean).map(v=>String(v).trim().toLowerCase()):[];
function overlap(a,b){a=new Set(clean(a));b=new Set(clean(b));if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n);}
const identities=(f,field)=>f.canonical?.[field]??f[field];
function similarity(a,b,mode){const g=overlap(identities(a,'genres'),identities(b,'genres')),c=overlap(identities(a,'countries'),identities(b,'countries')),d=overlap(identities(a,'directors'),identities(b,'directors')),y=a.year&&b.year?Math.exp(-Math.abs(a.year-b.year)/12):0;
return mode==='genres'?g:mode==='countries'?c:mode==='directors'?d:mode==='year'?y:.5*g+.2*c+.2*d+.1*y;}
function seriesKey(f){return f.series_id?'id:'+f.series_id:f.series?'name:'+f.series.trim().toLowerCase():null;}
function key(f,mode){if(mode==='year')return f.year?Math.floor(f.year/10)*10+'年代':'年份未知';const field=mode==='countries'?'countries':mode==='directors'?'directors':'genres';return f.metadata_v2?.[field]?.[0]?.color_key||(f[field]||[])[0]||'资料缺失';}
// Restrained night-sky palette: ice, slate, periwinkle and a little starlight gold.
const skyPalette=['#91a9c4','#adc7d1','#a29dbf','#c4b58e','#8498b5','#b3b8cd','#bca7b4','#8aadb6'];
// Separate common genres by hue and warmth, without increasing halo opacity or radius.
const genreColors={"action":"#7f95c7","adventure":"#bea566","science fiction":"#6eb8b8","animation":"#a591c5","comedy":"#c58e82","fantasy":"#b484a8","drama":"#a3b0bb","thriller":"#7f9d89","horror":"#967f9c","romance":"#bd91a4","documentary":"#a6beb8","history":"#ad956e","war":"#8d9982","crime":"#7c99a6","mystery":"#928bb5","family":"#b2b58c","music":"#af9ab9","western":"#b18d77","tv movie":"#9ca9b6"};
function color(f,mode){const k=key(f,mode);if(k==='资料缺失'||k==='年份未知')return '#77818e';if(mode==='year'){if(!Number.isFinite(Number(f.year)))return '#77818e';const stops=[[141,167,195],[163,161,192],[198,183,149]],t=Math.max(0,Math.min(1,(f.year-1920)/110))*2,i=Math.min(1,Math.floor(t)),u=t-i;return '#'+stops[i].map((v,j)=>Math.round(v+(stops[i+1][j]-v)*u).toString(16).padStart(2,'0')).join('');}return (mode==='genres'&&genreColors[k.toLowerCase()])||skyPalette[hash(k)%skyPalette.length];}
// One graph for every view: all metadata values contribute, never first-label anchors.
function values(f,mode){if(mode==='year')return [f.year?Math.floor(f.year/10)*10+'年代':'年份未知'];const field=mode==='combined'?'genres':mode,a=identities(f,field)||[];return a.length?[...new Set(a.filter(Boolean))]:['资料缺失'];}
function facetFilm(f,field,id){const entity=f.metadata_v2?.[field]?.find(e=>e.id===id);return entity?{...f,metadata_v2:{...f.metadata_v2,[field]:[entity]}}:{...f,[field]:[id]};}
function matches(f,mode,value){return !value||values(f,mode).includes(value);}
function drift(id,time,enabled=true){if(!enabled)return{x:0,y:0};const h=hash(id),phase=h/4294967296*Math.PI*2,speed=.12+(h%17)*.006;return{x:7*Math.sin(time*speed+phase)+3*Math.sin(time*speed*.67+phase*2),y:6*Math.cos(time*speed*.83+phase)+2*Math.sin(time*.19+phase)};}
function layout(films){const n=films.length;if(!n)return{positions:[],edges:[],labels:[]};
const p=films.map(f=>{const h=hash(f.id),a=h/4294967296*Math.PI*2,r=90+Math.sqrt((hash(f.id+'radius')%10000)/10000)*440;return{x:1000+Math.cos(a)*r,y:650+Math.sin(a)*r*.7};});
const edges=[],seen=new Set();for(let i=0;i<n;i++){const near=[];for(let j=0;j<n;j++){if(i===j)continue;const s=similarity(films[i],films[j],'combined');if(s>.12)near.push({j,s});}near.sort((a,b)=>b.s-a.s||hash(films[a.j].id)-hash(films[b.j].id));for(const e of near.slice(0,8)){const pair=Math.min(i,e.j)+':'+Math.max(i,e.j);if(!seen.has(pair)){seen.add(pair);edges.push({a:i,b:e.j,s:e.s});}}}
for(let step=0;step<280;step++){const dx=new Float64Array(n),dy=new Float64Array(n);for(let i=0;i<n;i++){dx[i]+=(1000-p[i].x)*.0015;dy[i]+=(650-p[i].y)*.0015;for(let j=i+1;j<n;j++){let x=p[i].x-p[j].x,y=p[i].y-p[j].y,dd=x*x+y*y;if(dd<.01){x=.1;y=.1;dd=.02;}const d=Math.sqrt(dd),force=105/Math.max(100,dd)+(d<34?(34-d)/d*.14:0);dx[i]+=x*force;dy[i]+=y*force;dx[j]-=x*force;dy[j]-=y*force;}}
for(const e of edges){const x=p[e.b].x-p[e.a].x,y=p[e.b].y-p[e.a].y,d=Math.hypot(x,y)||1,force=(d-(28+90*(1-e.s)))/d*.028*e.s;dx[e.a]+=x*force;dy[e.a]+=y*force;dx[e.b]-=x*force;dy[e.b]-=y*force;}
for(let i=0;i<n;i++){p[i].x+=Math.max(-12,Math.min(12,dx[i]));p[i].y+=Math.max(-12,Math.min(12,dy[i]));}}
const minX=Math.min(...p.map(q=>q.x)),maxX=Math.max(...p.map(q=>q.x)),minY=Math.min(...p.map(q=>q.y)),maxY=Math.max(...p.map(q=>q.y)),expandX=1800/Math.max(1,maxX-minX),expandY=1100/Math.max(1,maxY-minY);for(const q of p){q.x=1000+(q.x-(minX+maxX)/2)*expandX;q.y=650+(q.y-(minY+maxY)/2)*expandY;}return{positions:p,edges,labels:[]};}
// Display-only luminance cap; exported colors and the expanded ribbon stay untouched.
function starColor(hex){if(!/^#[0-9a-f]{6}$/i.test(hex))return hex;const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)),luma=(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255,k=Math.min(1,.4/Math.max(.001,luma));return '#'+rgb.map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join('');}
function associationKey(f){return f.local_association?.id||seriesKey(f);}
function related(a,b,mode){if(mode==='directors')return overlap(identities(a,'directors'),identities(b,'directors'))>0;const key=associationKey(a);return !!key&&key===associationKey(b);}
// Full-library degree: own family excluded; each external family contributes once.
// Weighted mid-ranks give each family one vote, so sequel counts cannot dominate scale.
function associationSizes(films){
 const groups=films.map(f=>associationKey(f)||'film:'+f.id),counts=new Map();
 for(const g of groups)counts.set(g,(counts.get(g)||0)+1);
 const scores=films.map((f,i)=>{const links=new Map();for(let j=0;j<films.length;j++){
  if(groups[i]===groups[j])continue;
  const s=similarity(f,films[j],'combined');
  links.set(groups[j],Math.max(links.get(groups[j])||0,Math.max(0,s-.35)));
 }return [...links.values()].reduce((a,b)=>a+b,0);});
 const ordered=scores.map((score,i)=>({score,weight:1/counts.get(groups[i]),i})).sort((a,b)=>a.score-b.score);
 const result=new Array(films.length).fill(1),total=counts.size;
 if(!ordered.length||ordered[0].score===ordered.at(-1).score)return result;
 let below=0;
 for(let a=0;a<ordered.length;){let b=a,weight=0;while(b<ordered.length&&Math.abs(ordered[b].score-ordered[a].score)<1e-9)weight+=ordered[b++].weight;
  const rank=Math.max(0,Math.min(1,((below+weight/2)/total-.05)/.9));
  // Spread ranks around the median, preserving the original 0.8–1.3 bounds.
  const scale=rank<=.5?1-.2*Math.pow(1-2*rank,.6):1+.3*Math.pow(2*rank-1,.6);
  for(let k=a;k<b;k++)result[ordered[k].i]=scale;
  below+=weight;a=b;
 }return result;
}
// Core size follows the camera gently; halos keep their original radius/opacity.
function starMagnification(zoom=1){return 1.2*Math.max(.8,Math.min(2,Math.pow(Math.max(.01,zoom),.45)));}
function interpolatePoint(a,b,t){t=Math.max(0,Math.min(1,t));const u=t*t*(3-2*t);return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};}
const api={starMagnification,associationSizes,associationKey,facetFilm,identities,starColor,related,interpolatePoint,hash,overlap,similarity,seriesKey,key,color,values,matches,drift,layout};if(typeof module!=='undefined')module.exports=api;else root.LibraryLayout=api;
if(typeof WorkerGlobalScope!=='undefined'&&root instanceof WorkerGlobalScope)root.onmessage=e=>{try{root.postMessage({token:e.data.token,...layout(e.data.films,e.data.mode),starSizes:associationSizes(e.data.films)});}catch(error){root.postMessage({token:e.data.token,error:String(error)});}};
})(globalThis);
