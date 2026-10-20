/* Local, optional walkthrough. No network requests or persistent library changes. */
(function(root){
'use strict';
const T=s=>root.LibraryI18n?root.LibraryI18n.t(s):s;
const storageKey='film-atlas-tour-v1';
const steps=[
 {id:'overview',title:'从影色星图开始',text:'每颗星都是一部电影。位置来自类型、地区、导演和年份的综合相似度；距离近，代表资料更相似。',target:'#mapWrap'},
 {id:'size',title:'大小，代表关联程度',text:'星点越大，表示与片库中其他作品的综合关联越强，不代表评分更高。同系列数量不会直接放大星点，筛选后大小也保持不变。',target:'#mapWrap'},
 {id:'links',title:'连线，把同系列串起来',text:'全景只保留短距离连线。停留在一颗星上，会显示它所在系列的完整连接；移开后恢复简洁。现在亮起的是示例影片所属的系列。',target:'series'},
 {id:'ring',title:'走进一部电影的颜色',text:'点击星点，镜头聚焦，颜色舒展成圆环。时间沿圆环顺时针前进。悬浮移动选择光标，单击才更新中心截图，并固定跨时段的色彩回声。',target:'#filmStage'},
 {id:'info',title:'海报旁，是电影的身份',text:'片名、年份、类型、地区、导演和时长集中在这里。资料来自本地片库；尚未采样的影片也能查看资料，色环暂以空环占位。',target:'.poster-row'},
 {id:'series',title:'沿着系列继续看',text:'“同系列”列出这个系列的作品，并在星图上保留关联连接。选择另一部，会直接平移到它的位置，无需退回全景。长列表可以单独滚动。',target:'.related'},
 {id:'directors',title:'换一条线索：同导演',text:'这里已切换为“同导演”。列表显示至少有一位导演相同的作品，星图同步显示关联。可随时切回“同系列”。',target:'.related'},
 {id:'charts',title:'定位与画面',text:'蓝线显示亮度变化，紫线显示相邻采样色差，并与色带、色环同步定位。悬浮或方向键移动光标；单击或回车固定时刻，更新截图与色彩回声。',target:'#filmCharts'},
 {id:'facets',title:'位置不变，换一种观察方式',text:'回到全景后，可用类型、地区或年代改变辉光着色。下拉框能筛选对应属性；切换维度不会打乱电影的位置。',target:'.atlas-controls'},
 {id:'legend',title:'从分类或片名开始寻找',text:'下方标签是当前维度的快捷筛选，数字表示片库中的影片数。再次点击同一标签即可取消筛选。也可以使用上方搜索框查找片名、系列或导演。',target:'#legend'},
 {id:'finish',title:'现在，请开始探索',text:'选一颗感兴趣的星，走进它的颜色；也可以先用分类和搜索找到熟悉的电影。拖动平移，滚轮缩放，“全景”回到起点。顶部“观看导览”随时可以重看。',target:null}
];
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
 document.body.append(layer);const card=layer.querySelector('.tour-card'),spot=layer.querySelector('.tour-spot'),bar=layer.querySelector('.tour-progress i');let active=false,index=0,ticket=0,raf=0,snapshot=null,focusBefore=null,busy=false,priorInert=[],cardPlaced=false,viewportKey='',cardAnimation=null,scrollBefore=null,panelBefore=false;
 const getStep=()=>steps[index];
 function rawRect(){const target=getStep().target;if(!target)return null;if(target==='series')return api.seriesRect();const e=document.querySelector(target);return e&&!e.hidden?e.getBoundingClientRect():null;}
 function rectForStep(){const r=rawRect();if(!r||r.width<2||r.height<2)return null;const limit=innerWidth<=740?Math.max(8,innerHeight-card.getBoundingClientRect().height-24):innerHeight-8;const rect={left:Math.max(8,r.left-8),top:Math.max(8,r.top-8),right:Math.min(innerWidth-8,r.right+8),bottom:Math.min(limit,r.bottom+8)};return rect.right>rect.left&&rect.bottom>rect.top?rect:null;}
 function position(){if(!active)return;const mobile=innerWidth<=740,box=card.getBoundingClientRect();document.body.classList?.toggle('tour-mobile',mobile);if(mobile)document.body.style?.setProperty('--tour-card-space',(box.height+24)+'px');const r=rectForStep();spot.hidden=!r;if(r){spot.style.left=r.left+'px';spot.style.top=r.top+'px';spot.style.width=(r.right-r.left)+'px';spot.style.height=(r.bottom-r.top)+'px';}const key=innerWidth+':'+innerHeight+':'+box.height;if(mobile){card.style.left='12px';card.style.top=Math.max(12,innerHeight-box.height-12)+'px';}else if(busy||!cardPlaced||key!==viewportKey){const p=place(r,innerWidth,innerHeight,box.width,box.height);card.style.left=p.x+'px';card.style.top=p.y+'px';cardPlaced=!busy;viewportKey=key;}raf=requestAnimationFrame(position);}
 function revealTarget(){const target=getStep().target;if(!target||target==='series')return;const e=document.querySelector(target);if(!e)return;if(innerWidth<=740)root.LibraryResponsive?.scrollTarget(e);else if(innerWidth<1100)e.scrollIntoView?.({block:'center',behavior:'instant'});}
 async function go(next){
  cardAnimation?.cancel();cardAnimation=card.animate?.([{opacity:.72,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:document.body.classList?.contains('motion-reduced')?0:460,easing:'cubic-bezier(.2,.7,.2,1)'});
  cardPlaced=false;index=Math.max(0,Math.min(steps.length-1,next));const current=++ticket,step=getStep();layer.dataset.step=step.id;$('tourCount').textContent=String(index+1).padStart(2,'0')+' / '+steps.length;$('tourTitle').textContent=T(step.title);$('tourText').textContent=T(step.text);$('tourPrev').disabled=index===0;$('tourNext').textContent=index===0?T('开始导览'):index===steps.length-1?T('开始探索'):T('下一步');bar.style.width=((index+1)/steps.length*100)+'%';busy=true;$('tourNext').disabled=true;$('tourStatus').textContent=T('正在准备画面…');card.focus({preventScroll:true});
  try{api.present(step.id);root.LibraryResponsive?.presentTour(step.id);const start=performance.now();while(active&&current===ticket&&!api.settled(step.id)&&performance.now()-start<12000)await new Promise(resolve=>setTimeout(resolve,80));if(!active||current!==ticket)return;
   const note=api.note(step.id);$('tourStatus').textContent=note||(!api.settled(step.id)?T('画面暂未就绪，你仍可继续导览或稍后重试。'):'');
  }catch(error){if(!active||current!==ticket)return;$('tourStatus').textContent=T('这一部分暂时无法展示，可以继续下一步。');}
  if(active&&current===ticket){root.LibraryResponsive?.presentTour(step.id);if(innerWidth<=740)document.body.style?.setProperty('--tour-card-space',(card.getBoundingClientRect().height+24)+'px');revealTarget();busy=false;cardPlaced=false;$('tourNext').disabled=false;}
 }
 function finish(completed){if(!active)return;active=false;++ticket;cardAnimation?.cancel();cancelAnimationFrame(raf);layer.hidden=true;document.body.classList?.remove('tour-mobile');document.body.style?.removeProperty('--tour-card-space');for(const [el,value] of priorInert)el.inert=value;priorInert=[];try{localStorage.setItem(storageKey,completed?'complete':'skipped');}catch(_){}api.end(completed?{overview:true}:snapshot);root.LibraryResponsive?.setPanel(!completed&&panelBefore);if(scrollBefore&&innerWidth<1100)root.scrollTo?.({left:scrollBefore.x,top:completed?0:scrollBefore.y,behavior:'instant'});(focusBefore?.isConnected?focusBefore:opener).focus({preventScroll:true});}
 function start(){if(active)return;try{if(!localStorage.getItem(storageKey))localStorage.setItem(storageKey,'started');}catch(_){}root.LibraryI18n?.apply(layer);snapshot=api.snapshot();scrollBefore={x:root.scrollX||0,y:root.scrollY||0};panelBefore=!!document.body.classList?.contains('sheet-open');focusBefore=document.activeElement;priorInert=[...document.querySelectorAll('body > header,body > main,body > .creator-credit')].map(el=>[el,el.inert]);for(const [el] of priorInert)el.inert=true;active=true;layer.hidden=false;api.begin();go(0);position();}
 $('tourSkip').onclick=()=>finish(false);$('tourPrev').onclick=()=>go(index-1);$('tourNext').onclick=()=>{if(busy)return;if(index===steps.length-1)finish(true);else go(index+1);};
 layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}else if(e.key==='ArrowRight'&&!busy){e.preventDefault();$('tourNext').click();}else if(e.key==='ArrowLeft'&&index>0){e.preventDefault();go(index-1);}else if(e.key==='Tab'){const buttons=[...card.querySelectorAll('button')].filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===card)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===card)){e.preventDefault();first.focus();}}});
 opener.disabled=false;opener.onclick=start;let seen=false;try{seen=!!localStorage.getItem(storageKey);}catch(_){seen=true;}if(!seen)start();return{start,close:()=>finish(false)};
}
const api={steps,pickFilm,place,create};if(typeof module!=='undefined')module.exports=api;else root.LibraryTour=api;
})(globalThis);
