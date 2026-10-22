/* Presentation only. Gallery selection owns URLs; no extra movie data requests. */
(function(root){
'use strict';
function previewState(previous,{owner,src='',loading=false,alt=''}){
 const old=previous?.owner===owner?previous:{owner,src:'',alt:''};
 if(loading)return {...old,owner,status:'loading'};
 return {owner,src,alt:src?alt:'',status:src?'ready':'error'};
}
if(typeof module!=='undefined')module.exports={previewState};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),en=()=>root.LibraryI18n?.locale==='en',tr=(zh,english)=>en()?english:zh;
let results=[],selectedId=null,searchDismissed=false,composing=false,returnToSearch=false,focusFilm=false;
const input=$('search'),box=$('searchResults'),list=$('searchResultList');
function pick(f,event){
 if(!f||event?.isComposing||composing)return;
 selectedId=f.id;searchDismissed=true;returnToSearch=event?.detail===0||event?.type==='keydown';focusFilm=returnToSearch;
 renderResults();root.LibraryExperienceBridge?.choose(f);
}
function resultButton(f){
 const b=document.createElement('button');b.type='button';b.dataset.filmId=f.id;
 const title=document.createElement('span'),year=document.createElement('span'),current=document.createElement('span');
 title.className='search-result-title';title.textContent=root.LibraryI18n.title(f);
 year.className='search-result-year';year.textContent=f.year||tr('年份未知','Unknown year');
 current.className='search-result-current';current.textContent=tr('已选择','Selected');current.hidden=selectedId!==f.id;
 b.append(title,year,current);b.setAttribute('aria-current',String(selectedId===f.id));b.onclick=e=>pick(f,e);
 b.onkeydown=e=>{
  const index=results.findIndex(x=>x.id===f.id);let next;
  if(e.key==='ArrowDown')next=(index+1)%results.length;
  if(e.key==='ArrowUp')next=(index-1+results.length)%results.length;
  if(e.key==='Home')next=0;if(e.key==='End')next=results.length-1;
  if(next!==undefined){e.preventDefault();list.children[next]?.focus();}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();searchDismissed=true;renderResults();input.focus({preventScroll:true});searchDismissed=true;renderResults();}
 };return b;
}
function renderResults(){
 const show=!!input.value.trim()&&!searchDismissed&&!document.body.classList.contains('film-open');
 box.hidden=!show;$('searchClear').hidden=!input.value;input.setAttribute('aria-expanded',String(show));
 $('searchResultCount').textContent=tr(`找到 ${results.length} 部 · 本片集范围`,`${results.length} ${results.length===1?'result':'results'} in this collection`);
 const focusId=list.contains(document.activeElement)?document.activeElement.dataset.filmId:null;
 list.replaceChildren(...results.map(resultButton));
 if(!results.length){const p=document.createElement('p');p.textContent=tr('没有匹配的影片。可清空搜索或调整筛选。','No films match. Clear the search or change the filter.');list.append(p);}
 if(show&&focusId){const button=[...list.children].find(b=>b.dataset.filmId===focusId);(button||input).focus({preventScroll:true});}
}
document.addEventListener('atlas:filtered',e=>{
 results=e.detail.films;if(e.detail.selectedId)selectedId=e.detail.selectedId;
 const count=$('collectionCount');if(count)count.textContent=tr(`本片集收录 ${e.detail.total} 部`,`${e.detail.total} films in this collection`);renderResults();paintPreview();
});
document.addEventListener('atlas:selected',e=>{selectedId=e.detail.film.id;searchDismissed=true;renderResults();});
input.parentElement.append($('searchClear'));input.setAttribute('aria-controls','searchResults');input.setAttribute('aria-expanded','false');
input.addEventListener('compositionstart',()=>{composing=true;});input.addEventListener('compositionend',()=>{composing=false;});
input.addEventListener('input',()=>{searchDismissed=false;renderResults();});
input.addEventListener('focus',()=>{if(!document.body.classList.contains('film-open'))searchDismissed=false;renderResults();});
input.addEventListener('keydown',e=>{
 if(e.isComposing||composing||e.keyCode===229)return;
 if((e.key==='ArrowDown'||e.key==='ArrowUp')&&results.length){e.preventDefault();searchDismissed=false;renderResults();(e.key==='ArrowDown'?list.firstElementChild:list.lastElementChild)?.focus();}
 if(e.key==='Enter'&&results.length===1){e.preventDefault();pick(results[0],e);}
 if(e.key==='Escape'){e.stopPropagation();searchDismissed=true;renderResults();}
});
document.addEventListener('pointerdown',e=>{if(!box.contains(e.target)&&!input.parentElement.contains(e.target)){searchDismissed=true;renderResults();}});
$('searchClear').onclick=()=>{input.value='';searchDismissed=false;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();};
const analysis=$('analysisDisclosure');
if(analysis){analysis.open=false;analysis.addEventListener('toggle',()=>root.dispatchEvent(new Event('resize')));}
const figure=document.createElement('figure');figure.id='representativeFrame';figure.hidden=true;
const image=document.createElement('img');image.crossOrigin='anonymous';image.decoding='async';
const caption=document.createElement('figcaption'),frameLabel=document.createElement('span'),frameTime=document.createElement('time'),frameStatus=document.createElement('p');
frameStatus.id='representativeStatus';frameStatus.setAttribute('role','status');caption.append(frameLabel,frameTime);figure.append(image,caption,frameStatus);$('filmTimeline').before(figure);
let detailFilm=null,currentDoc=null,watch=null,syncCurrent=null,preview=null,failedUrl='',failedViewer=null,imageTicket=0;
function paintPreview(){
 if(!detailFilm){figure.hidden=true;return;}
 figure.hidden=!detailFilm.viewer_url;if(figure.hidden)return;
 const s=preview||{status:'loading',src:'',alt:''};figure.dataset.state=s.status;
 image.hidden=!s.src;frameLabel.textContent=tr('当前画面','Current frame');
 frameTime.textContent=s.alt?.match(/\b\d{2}:\d{2}(?::\d{2})?\b/)?.[0]||'—';
 frameStatus.hidden=s.status==='ready';
 frameStatus.textContent=s.status==='loading'?tr('正在载入画面…','Loading frame…'):tr('画面暂不可用，可在色带中选择另一时刻。','Frame unavailable. Choose another moment on the color strip.');
 if(s.src){
  image.alt=s.alt;
  if(image.getAttribute('src')!==s.src){
   const ticket=++imageTicket;
   image.onload=()=>{if(ticket!==imageTicket)return;if(!document.body.classList.contains('motion-reduced'))image.animate?.([{opacity:.72},{opacity:1}],{duration:240});};
   image.onerror=()=>{if(ticket!==imageTicket)return;failedUrl=s.src;preview=previewState(null,{owner:detailFilm.id});paintPreview();};image.src=s.src;
  }
 }else{++imageTicket;image.removeAttribute('src');image.alt='';}
}
function disconnectFrame(){watch?.disconnect();watch=null;currentDoc=null;syncCurrent=null;}
function connectFrame(){
 const frame=$('filmStage');let doc;
 if(!detailFilm||failedViewer===detailFilm.id||frame?.dataset.filmId!==detailFilm.id){disconnectFrame();return;}
 try{doc=frame.contentDocument;}catch(_){return;}
 if(!doc)return;if(doc===currentDoc){syncCurrent?.();return;}disconnectFrame();currentDoc=doc;
 const owner=detailFilm.id;
 const sync=()=>{
  if(owner!==detailFilm?.id||currentDoc!==doc)return;
  const source=doc.getElementById('centralFrame'),state=doc.getElementById('centralPreview');
  const loading=frame.dataset.ready!=='true'||state?.dataset.loading==='true',src=source?.getAttribute('src')?source.src:'';
  if(loading)failedUrl='';
  preview=previewState(preview,{owner,src:src===failedUrl?'':src,loading,alt:source?.alt||''});paintPreview();
 };
 syncCurrent=sync;watch=new MutationObserver(sync);watch.observe(doc,{subtree:true,attributes:true,attributeFilter:['src','alt','data-loading']});sync();
}
document.addEventListener('atlas:details',e=>{
 const next=e.detail.film;
 if(next.id!==detailFilm?.id){disconnectFrame();failedUrl='';failedViewer=null;preview={owner:next.id,src:'',alt:'',status:'loading'};}
 detailFilm=next;paintPreview();connectFrame();
});
document.addEventListener('atlas:viewer-error',e=>{if(detailFilm?.id===e.detail.film.id){disconnectFrame();failedViewer=detailFilm.id;preview=previewState(null,{owner:detailFilm.id});paintPreview();}});
document.addEventListener('atlas:viewer-loading',e=>{if(detailFilm?.id===e.detail.film.id){disconnectFrame();failedViewer=null;failedUrl='';preview={owner:detailFilm.id,src:'',alt:'',status:'loading'};paintPreview();}});
$('mapWrap').addEventListener('load',e=>{if(e.target.tagName==='IFRAME')connectFrame();},true);
new MutationObserver(connectFrame).observe($('mapWrap'),{childList:true,subtree:true,attributes:true,attributeFilter:['id','data-film-id','data-ready']});
let wasOpen=document.body.classList.contains('film-open');
new MutationObserver(()=>{
 const open=document.body.classList.contains('film-open');
 // Ignore unrelated motion class writes so search focus and scroll survive them.
 if(open!==wasOpen){wasOpen=open;
  if(open&&focusFilm){$('collapse').focus({preventScroll:true});focusFilm=false;}
  if(!open){disconnectFrame();detailFilm=null;preview=null;paintPreview();searchDismissed=false;renderResults();
   if(returnToSearch){returnToSearch=false;input.focus({preventScroll:true});
    // Wait for the inspector's visibility transition to release the toolbar.
    requestAnimationFrame(()=>{if(!document.body.classList.contains('film-open')&&document.activeElement!==input)input.focus({preventScroll:true});});
   }
  }else renderResults();
 }connectFrame();
}).observe(document.body,{attributes:true,attributeFilter:['class']});
$('language').addEventListener('change',()=>{renderResults();paintPreview();const count=$('collectionCount'),n=root.LibraryExperienceBridge?.getFilms().length;if(count&&n)count.textContent=tr(`本片集收录 ${n} 部`,`${n} films in this collection`);});
})(globalThis);
