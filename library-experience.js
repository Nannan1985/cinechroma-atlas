/* Local presentation enhancements; no extra data fetches or recommendation ranking. */
(function(){
'use strict';
const $=id=>document.getElementById(id),en=()=>window.LibraryI18n?.locale==='en',tr=(zh,english)=>en()?english:zh;
let results=[],selectedId=null,activeIndex=-1,searchDismissed=false;
function renderResults(){
 const box=$('searchResults'),list=$('searchResultList'),input=$('search');if(!box||!list)return;
 const show=!!input.value.trim()&&!searchDismissed&&!document.body.classList.contains('film-open');box.hidden=!show;$('searchClear').hidden=!input.value;input.setAttribute('aria-expanded',String(show));
 $('searchResultCount').textContent=tr(`找到 ${results.length} 部 · 本片集范围`,`${results.length} results in this collection`);
 list.replaceChildren(...results.map((f,i)=>{const b=document.createElement('button');b.type='button';b.textContent=(LibraryI18n.title(f))+(f.year?' · '+f.year:'');b.dataset.filmId=f.id;b.setAttribute('aria-current',String(selectedId===f.id));b.onclick=()=>{selectedId=f.id;searchDismissed=true;renderResults();window.LibraryExperienceBridge?.choose(f);};b.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=(i+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;list.children[next]?.focus();}if(e.key==='Escape'){searchDismissed=true;renderResults();input.focus();}};return b;}));
 if(!results.length){const p=document.createElement('p');p.textContent=tr('没有匹配的影片。可清空搜索或调整筛选。','No films match. Clear the search or change the filter.');list.append(p);}
}
document.addEventListener('atlas:filtered',e=>{results=e.detail.films;selectedId=e.detail.selectedId;const count=$('collectionCount');if(count)count.textContent=tr(`本片集收录 ${e.detail.total} 部`,`${e.detail.total} films in this collection`);renderResults();});
document.addEventListener('atlas:selected',e=>{selectedId=e.detail.film.id;searchDismissed=true;renderResults();});
const input=$('search');input.parentElement.append($('searchClear')); input.setAttribute('aria-controls','searchResults');input.setAttribute('aria-expanded','false');
input.addEventListener('input',()=>{searchDismissed=false;renderResults();});input.addEventListener('focus',()=>{searchDismissed=false;renderResults();});
input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&results.length){e.preventDefault();searchDismissed=false;renderResults();$('searchResultList').firstElementChild?.focus();}if(e.key==='Enter'&&results.length===1){e.preventDefault();window.LibraryExperienceBridge?.choose(results[0]);}if(e.key==='Escape'){searchDismissed=true;renderResults();}});
$('searchClear').onclick=()=>{input.value='';searchDismissed=false;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();};
const analysis=$('analysisDisclosure');if(analysis){analysis.open=innerWidth>1099&&innerHeight>900;analysis.addEventListener('toggle',()=>window.dispatchEvent(new Event('resize')));}
const figure=document.createElement('figure');figure.id='representativeFrame';figure.hidden=true;
const image=document.createElement('img');image.crossOrigin='anonymous';const caption=document.createElement('figcaption');figure.append(image,caption);$('filmTimeline').before(figure);
let currentDoc=null,watch=null;
function connectFrame(){const frame=$('filmStage');let doc;try{doc=frame?.contentDocument;}catch(_){return;}if(!doc||doc===currentDoc)return;watch?.disconnect();currentDoc=doc;
 const sync=()=>{const source=doc.getElementById('centralFrame'),state=doc.getElementById('centralPreview');if(!source?.getAttribute('src')||state?.dataset.loading==='true')return;const src=source.src;if(image.src!==src)image.src=src;image.alt=source.alt;caption.textContent=source.alt;figure.hidden=false;};
 watch=new MutationObserver(sync);watch.observe(doc,{subtree:true,attributes:true,attributeFilter:['src','alt','data-loading']});sync();}
$('mapWrap').addEventListener('load',e=>{if(e.target.tagName==='IFRAME')connectFrame();},true);
new MutationObserver(connectFrame).observe($('mapWrap'),{childList:true,subtree:true,attributes:true,attributeFilter:['id']});
new MutationObserver(()=>{if(!document.body.classList.contains('film-open')){searchDismissed=false;renderResults();}else renderResults();connectFrame();}).observe(document.body,{attributes:true,attributeFilter:['class']});
$('language').addEventListener('change',()=>{renderResults();const count=$('collectionCount'),n=window.LibraryExperienceBridge?.getFilms().length;if(count&&n)count.textContent=tr(`本片集收录 ${n} 部`,`${n} films in this collection`);});
image.onerror=()=>{figure.hidden=true;};
})();
