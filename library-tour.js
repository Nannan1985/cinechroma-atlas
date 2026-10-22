/* Local, optional walkthrough. No network requests or persistent library changes. */
(function(root){
'use strict';
const T=s=>root.LibraryI18n?root.LibraryI18n.t(s):s;
const storageKey='film-atlas-tour-v1';
const steps=[
 {id:'overview',title:'从影色星图开始',text:'每颗星都是一部电影。位置综合类型、地区、导演和年份，近邻提示资料关联；距离不是精确度量，也不代表评分。',target:'#mapWrap'},
 {id:'size',title:'大小，代表关联程度',text:'较大的星点，表示与本片集的综合关联较强，不代表评分或偏好。系列数量不会直接放大星点，筛选也不改变大小。',target:'#mapWrap'},
 {id:'links',title:'连线，把同系列串起来',text:'全景保留短距离系列连线。悬停或选片后，显示本片集中该系列的完整连接；移开后恢复简洁。',target:'series'},
 {id:'ring',title:'走进一部电影的颜色',text:'点击星点进入影片。时间沿圆环顺时针前进；点选一个时刻，中心画面与色彩回声随之更新。',target:'#filmStage'},
 {id:'info',title:'海报旁，是电影的身份',text:'片名和年份在海报旁，导演、类型、制片地区与时长在下方。画面来自已有采样，资料保留已确认的译名。',target:'.poster-row'},
 {id:'series',title:'沿着系列继续看',text:'“同系列”只列出本片集已收录的作品。点选另一部，镜头直接平移过去；列表可单独滚动。',target:'.related'},
 {id:'directors',title:'换一条线索：同导演',text:'这里列出本片集中至少有一位导演相同的作品，并同步显示连线。这不是导演完整作品集。',target:'.related'},
 {id:'charts',title:'定位与画面',text:'色带、色环与两条曲线共用时间定位。悬浮或方向键移动光标；点选或回车更新画面。分析图表可随时展开。',target:'#filmCharts'},
 {id:'facets',title:'位置不变，换一种观察方式',text:'类型、地区或年代改变星点着色；下拉框按对应属性筛选，电影的位置保持不变。',target:'.atlas-controls'},
 {id:'legend',title:'从分类或片名开始寻找',text:'分类数字只统计本片集。点选标签筛选，再点取消；搜索片名、系列或导演后，直接点选结果。',target:'#legend'},
 {id:'finish',title:'现在，请开始探索',text:'选一颗星，或搜索一部熟悉的电影。“全景”恢复初始视角，顶部“完整导览”随时可重看。',target:null}
];
const introSteps=[{"id":"overview","title":"移动与缩放","text":"每颗星是一部电影，位置来自类型、地区、导演和年份的综合相似度。拖动平移，双指或滚轮缩放；“全景”恢复视角。","target":"#mapWrap"},{"id":"ring","title":"选择一部电影","text":"点选星点，或搜索片名后点选结果，进入影片色环。返回星图可继续探索；较大的星点表示本片集内关联较强。","target":"#filmStage"},{"id":"charts","title":"探索时间与色彩","text":"点选圆环或色带定位时间，查看真实采样画面。资料面板可滚动，色彩分析可展开；需要更多说明时打开“完整导览”。","target":"#filmTimeline"}];
function pickFilm(films,seriesKey){
 const counts=new Map(),directors=new Map();for(const f of films){const key=seriesKey(f);if(key)counts.set(key,(counts.get(key)||0)+1);for(const d of f.canonical?.directors||f.directors||[])directors.set(d,(directors.get(d)||0)+1);}
 return [...films].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0]||null;
 function score(f){const n=counts.get(seriesKey(f))||0,d=Math.max(0,...(f.canonical?.directors||f.directors||[]).map(x=>directors.get(x)||0));return(f.viewer_url?1000:0)+(n>=2?200:0)+(d>=2?80:0)+(f.poster?20:0)+Math.min(n,8);}
}
function place(rect,w,h,cw,ch){
 const pad=16,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));if(!rect)return{x:Math.max(pad,(w-cw)/2),y:Math.max(pad,(h-ch)/2)};
 const options=[{x:rect.right+20,y:rect.top},{x:rect.left-cw-20,y:rect.top},{x:rect.left,y:rect.bottom+20},{x:rect.left,y:rect.top-ch-20}].map(p=>({x:clamp(p.x,pad,w-cw-pad),y:clamp(p.y,pad,h-ch-pad)}));
 const overlap=p=>Math.max(0,Math.min(p.x+cw,rect.right)-Math.max(p.x,rect.left))*Math.max(0,Math.min(p.y+ch,rect.bottom)-Math.max(p.y,rect.top));return options.sort((a,b)=>overlap(a)-overlap(b))[0];
}
function create(api){
 const $=id=>document.getElementById(id),opener=$('tourStart');if(!opener)return;
 const layer=document.createElement('div');layer.id='atlasTour';layer.hidden=true;
 layer.innerHTML='<div class="tour-shield"></div><div class="tour-spot" aria-hidden="true"></div><section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourText" tabindex="-1"><div class="tour-top"><span id="tourCount"></span><button id="tourSkip" type="button">跳过导览</button></div><div class="tour-progress" aria-hidden="true"><i></i></div><h2 id="tourTitle"></h2><p id="tourText"></p><p id="tourStatus" role="status"></p><div class="tour-actions"><button id="tourPrev" type="button">上一步</button><button id="tourNext" type="button">下一步</button></div><span class="tour-keyboard">← → 切换步骤 · 退出键关闭</span></section>';
 document.body.append(layer);const card=layer.querySelector('.tour-card'),spot=layer.querySelector('.tour-spot'),bar=layer.querySelector('.tour-progress i');let active=false,index=0,ticket=0,raf=0,snapshot=null,focusBefore=null,busy=false,priorInert=[],cardPlaced=false,viewportKey='',cardAnimation=null,scrollBefore=null,panelBefore=false,analysisBefore=false,activeSteps=steps;
 const getStep=()=>activeSteps[index];
 function rawRect(){const target=getStep().target;if(!target)return null;if(target==='series')return api.seriesRect();const e=document.querySelector(target);return e&&!e.hidden?e.getBoundingClientRect():null;}
 function rectForStep(){const r=rawRect();if(!r||r.width<2||r.height<2)return null;const limit=innerWidth<=740?Math.max(8,innerHeight-card.getBoundingClientRect().height-24):innerHeight-8;const rect={left:Math.max(8,r.left-8),top:Math.max(8,r.top-8),right:Math.min(innerWidth-8,r.right+8),bottom:Math.min(limit,r.bottom+8)};return rect.right>rect.left&&rect.bottom>rect.top?rect:null;}
 function position(){if(!active)return;const mobile=innerWidth<=740,box=card.getBoundingClientRect();document.body.classList?.toggle('tour-mobile',mobile);if(mobile)document.body.style?.setProperty('--tour-card-space',(box.height+24)+'px');const r=rectForStep();spot.hidden=!r;if(r){spot.style.left=r.left+'px';spot.style.top=r.top+'px';spot.style.width=(r.right-r.left)+'px';spot.style.height=(r.bottom-r.top)+'px';}const key=innerWidth+':'+innerHeight+':'+box.height;if(mobile){card.style.left='12px';card.style.top=Math.max(12,innerHeight-box.height-12)+'px';}else if(busy||!cardPlaced||key!==viewportKey){const p=place(r,innerWidth,innerHeight,box.width,box.height);card.style.left=p.x+'px';card.style.top=p.y+'px';cardPlaced=!busy;viewportKey=key;}raf=requestAnimationFrame(position);}
 function revealTarget(){const target=getStep().target;if(!target||target==='series')return;const e=document.querySelector(target);if(!e)return;if(innerWidth<=740)root.LibraryResponsive?.scrollTarget(e);else if(innerWidth<1100)e.scrollIntoView?.({block:'center',behavior:'instant'});}
 async function go(next){
  cardAnimation?.cancel();cardAnimation=card.animate?.([{opacity:.72,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:document.body.classList?.contains('motion-reduced')?0:460,easing:'cubic-bezier(.2,.7,.2,1)'});
  cardPlaced=false;index=Math.max(0,Math.min(activeSteps.length-1,next));const current=++ticket,step=getStep();layer.dataset.step=step.id;if($('analysisDisclosure'))$('analysisDisclosure').open=step.id==='charts'&&activeSteps===steps?true:analysisBefore;$('tourCount').textContent=String(index+1).padStart(2,'0')+' / '+activeSteps.length;$('tourTitle').textContent=T(step.title);$('tourText').textContent=T(step.text);$('tourPrev').disabled=index===0;$('tourNext').textContent=index===activeSteps.length-1?T('开始探索'):T('下一步');bar.style.width=((index+1)/activeSteps.length*100)+'%';busy=true;$('tourNext').disabled=true;$('tourStatus').textContent=T('正在准备画面…');card.focus({preventScroll:true});
  try{api.present(step.id);root.LibraryResponsive?.presentTour(step.id);const start=performance.now();while(active&&current===ticket&&!api.settled(step.id)&&performance.now()-start<12000)await new Promise(resolve=>setTimeout(resolve,80));if(!active||current!==ticket)return;
   const note=api.note(step.id);$('tourStatus').textContent=note||(!api.settled(step.id)?T('画面暂未就绪，你仍可继续导览或稍后重试。'):'');
  }catch(error){if(!active||current!==ticket)return;$('tourStatus').textContent=T('这一部分暂时无法展示，可以继续下一步。');}
  if(active&&current===ticket){root.LibraryResponsive?.presentTour(step.id);if(innerWidth<=740)document.body.style?.setProperty('--tour-card-space',(card.getBoundingClientRect().height+24)+'px');revealTarget();busy=false;cardPlaced=false;$('tourNext').disabled=false;}
 }
 function finish(completed){if(!active)return;active=false;++ticket;cardAnimation?.cancel();cancelAnimationFrame(raf);layer.hidden=true;document.body.classList?.remove('tour-mobile');document.body.style?.removeProperty('--tour-card-space');for(const [el,value] of priorInert)el.inert=value;priorInert=[];try{localStorage.setItem(storageKey,completed?'complete':'skipped');}catch(_){}if($('analysisDisclosure'))$('analysisDisclosure').open=analysisBefore;api.end(completed?{overview:true}:snapshot);root.LibraryResponsive?.setPanel(!completed&&panelBefore);if(scrollBefore&&innerWidth<1100)root.scrollTo?.({left:scrollBefore.x,top:completed?0:scrollBefore.y,behavior:'instant'});(focusBefore?.isConnected?focusBefore:opener).focus({preventScroll:true});}
 function start(mode='full'){if(active)return;activeSteps=mode==='intro'?introSteps:steps;analysisBefore=!!$('analysisDisclosure')?.open;layer.dataset.mode=mode==='intro'?'intro':'full';try{if(!localStorage.getItem(storageKey))localStorage.setItem(storageKey,'started');}catch(_){}root.LibraryI18n?.apply(layer);snapshot=api.snapshot();scrollBefore={x:root.scrollX||0,y:root.scrollY||0};panelBefore=!!document.body.classList?.contains('sheet-open');focusBefore=document.activeElement;priorInert=[...document.querySelectorAll('body > header,body > main,body > .creator-credit,body > .collection-about')].map(el=>[el,el.inert]);for(const [el] of priorInert)el.inert=true;active=true;layer.hidden=false;api.begin();go(0);position();}
 $('tourSkip').onclick=()=>finish(false);$('tourPrev').onclick=()=>go(index-1);$('tourNext').onclick=()=>{if(busy)return;if(index===activeSteps.length-1)finish(true);else go(index+1);};
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}else if(e.key==='ArrowRight'&&!busy){e.preventDefault();$('tourNext').click();}else if(e.key==='ArrowLeft'&&index>0){e.preventDefault();go(index-1);}else if(e.key==='Tab'){const buttons=[...card.querySelectorAll('button')].filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===card)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===card)){e.preventDefault();first.focus();}}});
 opener.disabled=false;opener.onclick=()=>start('full');let seen=false;try{seen=!!localStorage.getItem(storageKey);}catch(_){seen=true;}if(!seen)start('intro');return{start,close:()=>finish(false)};
}
const api={steps,introSteps,pickFilm,place,create};if(typeof module!=='undefined')module.exports=api;else root.LibraryTour=api;
})(globalThis);
