'use strict';
(async()=>{
const I=window.LibraryI18n,T=s=>I?I.t(s):s,filmName=f=>I?I.title(f):f.title,seriesName=f=>I?I.association(f):f.series,terms=(f,k)=>I?I.terms(f,k):f[k],facetName=(f,k,v)=>I?I.facetLabel(f,k,v):v;
const starSizes=new Map();
const $=id=>document.getElementById(id),L=LibraryLayout,G=LibraryGestures,canvas=$('atlas'),ctx=canvas.getContext('2d');
let films=[],visible=[],positions=[],targets=[],mode='genres',selected=null,hovered=null,token=0,labels=[],edges=[],worker=null,raf=0,width=1,height=1,pan={x:0,y:0},zoom=1,drag=null,animating=false;
const charts=LibraryCharts.create($('filmCharts'),$('filmTimeline'));
let canvasSizeDirty=true,focusShift=0,mobileSheetGeometry=null,sheetTween=null,sheetMeasureFrame=0;
const starPalettes=new Map();
let frameReveal=null,preparedFrame=null,cancelLoad=null,incomingFrame=null,previousFrame=null,frameSwap=null,displayedFilm=null,facetTransition=null,visuals=[];
const mixColor=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const A=LibraryAtmosphere;
let background=A.makeBackground(document,[],L.hash),seriesGroups=[],seriesByFilm=new Map(),visibleIndices=new Set(),relationEdges=[];
let hoverSince=0,hoverLevel=0,hoverSnapshot=null,hoverGroup=null;
const frameWidth=()=>Math.min(Math.max(1,width-2*focusShift)*(innerWidth<=740?1.45:1),height/.73,typeof mobileSheetGeometry==='object'&&mobileSheetGeometry?mobileSheetGeometry.width:Infinity);
const byId=new Map(),viewNames={combined:'综合相似',genres:'类型',countries:'地区',year:'年代',directors:'导演'};
const description={combined:'位置固定为综合相似度：类型50% · 地区20% · 导演20% · 年份10%，全部类型均参与关系计算。',genres:'位置不变；辉光按首个类型着色，筛选会匹配影片的全部类型。',countries:'位置不变；辉光按首个制作地区着色，筛选会匹配全部地区。',year:'位置不变；年份辉光从冷到暖连续变化，可按年代筛选。',directors:'位置不变；辉光按首位导演着色，筛选会匹配全部导演。'};
// One isotropic world-to-screen transform; visual size and touch targets are separate.
let cameraFit=G.fit([],width,height),hitMenu=null;
const camera=()=>({...cameraFit,pan:{...pan},zoom});
const scale=()=>cameraFit.scale*zoom,scaleY=()=>scale();
let expansion=0,openTarget=0,frameToken=0,frameReady=false,frameOpened=false,relationMode='series',focusAnchor=null,panTween=null,skipUnfold=false,pendingFilm=null,switchStarted=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled=!reduced.matches,motionOverride=false,ambientTime=0,lastDraw=0,lastPaint=0,morph=null,facet='',layoutLoaded=false,tourLayoutReady=false,drifts=[];
const point=i=>{const p=positions[i],d=drifts[i]||{x:0,y:0},anchor=focusAnchor||p,t=A.smooth(expansion),z=1+.45*t,c=cameraFit.center,o=cameraFit.origin;return {x:(p.x+d.x-c.x)*scale()*z+o.x*(1-t)+(width/2-focusShift)*t+pan.x*(1-t)-(anchor.x-c.x)*scale()*z*t,y:(p.y+d.y-c.y)*scaleY()*z+o.y*(1-t)+focusY()*t+pan.y*(1-t)-(anchor.y-c.y)*scaleY()*z*t};};
// The ring follows the camera's focus plane, never the destination star before arrival.
const ringPoint=()=>{const p=focusAnchor||cameraFit.center,t=A.smooth(expansion),z=1+.45*t,c=cameraFit.center,o=cameraFit.origin;return{x:(p.x-c.x)*scale()*z*(1-t)+o.x*(1-t)+(width/2-focusShift)*t+pan.x*(1-t),y:(p.y-c.y)*scaleY()*z*(1-t)+o.y*(1-t)+focusY()*t+pan.y*(1-t)};};
function focusY(){return typeof mobileSheetGeometry==='object'&&mobileSheetGeometry?mobileSheetGeometry.y:height/2+20;}
const frameMix=now=>frameSwap&&motionEnabled?A.smooth((now-frameSwap.start)/900):1;
function transitionTo(value){openTarget=value;morph={from:expansion,to:value,start:performance.now(),duration:(value?1500:1200)*Math.max(.25,Math.abs(value-expansion))};requestDraw();}
function syncMotion(){const b=$('motion');b.textContent=motionEnabled?T('动态 开'):T('动态 关');b.setAttribute('aria-pressed',String(motionEnabled));const child=$('filmStage').contentWindow;if(frameReady&&child?.FilmGallery&&child.FilmGallery.getState().motionEnabled!==motionEnabled)child.document.getElementById('motion').click();requestDraw();}
function requestDraw(){if(!raf)raf=requestAnimationFrame(draw);}
function relatedFilms(f){return f?films.filter(x=>L.related(f,x,relationMode)):[];}
function worldPosition(f){const i=byId.get(f.id),p=positions[i],d=drifts[i]||{x:0,y:0};return{x:p.x+d.x,y:p.y+d.y};}
function draw(now){raf=0;if(document.hidden)return;updateSheetGeometry(now);if(now-lastPaint<30&&!canvasSizeDirty){requestDraw();return;}if(canvasSizeDirty){const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);canvasSizeDirty=false;}const dt=Math.min(80,now-(lastDraw||now));lastDraw=now;lastPaint=now;if(motionEnabled)ambientTime+=dt/1000;drifts=films.map((f,i)=>{const raw=L.drift(f.id,ambientTime*1.55,motionEnabled),goal=hovered?.id===f.id&&hoverSnapshot?hoverSnapshot:{x:raw.x*1.65,y:raw.y*1.65},previous=drifts[i]||goal;return motionEnabled?{x:previous.x+(goal.x-previous.x)*.12,y:previous.y+(goal.y-previous.y)*.12}:{x:0,y:0};});const hoverGoal=hovered&&!selected&&!drag&&now-hoverSince>=280?1:0;hoverLevel=motionEnabled?hoverLevel+(hoverGoal-hoverLevel)*Math.min(1,dt/130):hoverGoal;if(morph){const t=motionEnabled?Math.min(1,(now-morph.start)/morph.duration):1;expansion=morph.from+(morph.to-morph.from)*(t*t*(3-2*t));if(t===1)morph=null;}
if(selected&&!openTarget&&expansion===0){selected=null;focusAnchor=null;panTween=null;switchStarted=null;releaseFilm();document.body.classList.remove('film-open');}

if(selected&&openTarget){const target=worldPosition(selected);if(panTween){const t=motionEnabled?Math.min(1,(now-panTween.start)/1100):1;focusAnchor=L.interpolatePoint(panTween.from,target,t);if(t===1)panTween=null;}else focusAnchor=target;}
canvas.dataset.cameraMotion=panTween?'pan':morph?'zoom':'idle';
document.body.classList.toggle('film-open',!!selected);document.body.classList.toggle('motion-reduced',!motionEnabled);$('collapse').hidden=!openTarget;updatePresentation(now);
if(preparedFrame&&!frameSwap){const ready=preparedFrame;preparedFrame=null;if(ready.ticket===frameToken&&openTarget)commitFilmFrame(ready.frame,ready.f);}
if(frameReady&&!frameOpened&&(skipUnfold?(!panTween||!motionEnabled||now-panTween.start>440):expansion>.58)&&openTarget){frameOpened=true;const child=$('filmStage').contentWindow,ticket=frameToken;if(skipUnfold&&child.FilmGallery.getState().motionEnabled)child.document.getElementById('motion').click();child.FilmGallery.open(0);syncMotion();child.requestAnimationFrame(()=>child.requestAnimationFrame(()=>{if(ticket!==frameToken||!openTarget)return;$('stageStatus').hidden=true;$('filmStage').dataset.ready='true';frameReveal={start:performance.now()};requestDraw();}));}
if(selected){const p=ringPoint(),fw=frameWidth();for(const frame of [$('filmStage'),incomingFrame,previousFrame].filter(Boolean)){frame.style.left=p.x+'px';frame.style.top=(p.y+.015*fw)+'px';frame.style.width=fw+'px';frame.style.height=fw*.73+'px';}}
updateVisuals(now);
ctx.clearRect(0,0,width,height);let moving=false;
for(let i=0;i<positions.length;i++){const p=positions[i],t=targets[i]||p;if(Math.hypot(p.x-t.x,p.y-t.y)>.15){p.x+=(t.x-p.x)*.15;p.y+=(t.y-p.y)*.15;moving=true;}else{p.x=t.x;p.y=t.y;}}
animating=moving;
const depthFocus=focusAnchor?{x:(focusAnchor.x-cameraFit.center.x)*scale()+focusShift,y:(focusAnchor.y-cameraFit.center.y)*scaleY()}:null;
A.drawBackground(ctx,background,width,height,pan,zoom,depthFocus,expansion);
drawConstellations();
if(zoom<1.65&&expansion<.1){ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#60768a';for(const label of labels){if(label.count<3)continue;const x=(label.x-cameraFit.center.x)*scale()+cameraFit.origin.x+pan.x,y=(label.y-cameraFit.center.y)*scaleY()+cameraFit.origin.y+pan.y;ctx.fillText(label.key+' · '+label.count,x,y-42);}}
const family=new Set(relatedFilms(selected).map(f=>f.id));for(const f of films){const i=byId.get(f.id),v=visuals[i];if(!v||v.alpha<.002)continue;const p=point(i);if(p.x<-40||p.x>width+40||p.y<-40||p.y>height+40)continue;const active=selected?.id===f.id,hover=hovered?.id===f.id,related=family.has(f.id),color=related?(relationMode==='series'?'#c4b58e':'#adc7d1'):v.color;ctx.save();ctx.globalAlpha=starOpacity(active,related)*v.alpha;drawStar(f,p,color,hover||related);ctx.restore();}
drawHoverLabels();
if(selected&&expansion>0){
 const blend=frameMix(now);
 if(pendingFilm&&displayedFilm&&!displayedFilm.viewer_url)drawPlaceholder(displayedFilm);
 else if(!selected.viewer_url)drawPlaceholder(selected,blend);
 if(frameSwap?.fromPlaceholder)drawPlaceholder(frameSwap.fromPlaceholder,1-blend);
}
ctx.globalAlpha=1;if(moving||morph||panTween||frameSwap||frameReveal||facetTransition||sheetTween||motionEnabled||(hovered&&!selected&&(now-hoverSince<700||Math.abs(hoverLevel-hoverGoal)>.01)))requestDraw();
}

// Fade attention with the camera: the untouched overview always starts at alpha .8.
function starOpacity(active,related){const focus=A.smooth(expansion);if(active)return .8*(frameOpened?1-focus:Math.max(.4,1-focus));return .8+(related?.56-.8:.16-.8)*focus;}
function updatePresentation(now){
 const phase=(a,b)=>A.smooth(Math.max(0,Math.min(1,(expansion-a)/(b-a))));
 const detail=$('details'),poster=phase(.22,.62),relations=phase(.4,.78),curves=phase(.62,.98);
 detail.style.setProperty('--panel-reveal',String(phase(.15,.55)));
 detail.style.setProperty('--poster-reveal',String(poster));detail.style.setProperty('--relation-reveal',String(relations));detail.style.setProperty('--chart-reveal',String(curves));
 detail.inert=!openTarget||poster<.6;$('filmCharts').inert=!openTarget||!!pendingFilm||curves<.9;
 const frame=$('filmStage'),closing=!openTarget;
 const blend=frameMix(now);
 const reveal=frameReveal&&motionEnabled?A.smooth((now-frameReveal.start)/650):1;
 if(reveal===1)frameReveal=null;const opacity=(closing?phase(.08,.65):1)*reveal;
 frame.style.opacity=String(frame.dataset.ready==='true'?opacity*blend:0);
 frame.style.pointerEvents=openTarget&&!pendingFilm&&frame.dataset.ready==='true'?'auto':'none';
 if(previousFrame){previousFrame.style.opacity=String(opacity*(1-blend));if(blend===1){previousFrame.remove();previousFrame=null;frameSwap=null;}}
 canvas.dataset.presentation=closing?(selected?'closing':'overview'):pendingFilm?'loading-next':frameSwap?'crossfading':panTween?'panning':morph?'opening':'focused';
}
function discardIncoming(){preparedFrame=null;if(cancelLoad){cancelLoad();cancelLoad=null;}if(incomingFrame){incomingFrame.remove();incomingFrame=null;}}
function releaseFilm(){++frameToken;discardIncoming();if(previousFrame){previousFrame.remove();previousFrame=null;}frameSwap=null;frameReveal=null;displayedFilm=null;frameReady=false;frameOpened=false;const frame=$('filmStage');frame.dataset.ready='false';frame.hidden=true;frame.removeAttribute('src');charts.setEmpty(T('选择影片查看时间曲线'));$('stageStatus').hidden=true;}
function queueFilm(f,switching){switchStarted=switching?performance.now():null;discardIncoming();if(!switching){if(previousFrame){previousFrame.remove();previousFrame=null;}frameSwap=null;}pendingFilm=switching&&displayedFilm?{f,start:switchStarted}:null;if(!pendingFilm)showDetails(f);mountFilm(f,!!pendingFilm);}
function animateDetails(){if(!motionEnabled)return;for(const node of [$('poster').parentElement,$('seriesList'),$('filmCharts')])node?.animate?.([{opacity:.86,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:720,easing:'cubic-bezier(.2,.7,.2,1)'});}
function updateVisuals(now){
 if(!facetTransition)return;const t=motionEnabled?A.smooth((now-facetTransition.start)/620):1;
 visuals=facetTransition.from.map((v,i)=>({alpha:v.alpha+(facetTransition.to[i].alpha-v.alpha)*t,color:mixColor(v.color,facetTransition.to[i].color,t)}));
 if(t===1)facetTransition=null;
}
function transitionFacets(){
 updateVisuals(performance.now());const to=films.map((f,i)=>({alpha:visibleIndices.has(i)?1:0,color:mode==='combined'?'#aebbcf':L.color(f,mode)}));
 if(!visuals.length||!motionEnabled){visuals=to;facetTransition=null;}else facetTransition={from:visuals.map(v=>({...v})),to,start:performance.now()};
}
function rebuildAtmosphere(){
 seriesGroups=A.constellations(films,targets,L.associationKey);seriesByFilm=new Map();for(const group of seriesGroups)for(const i of group.members)seriesByFilm.set(films[i].id,group);
 background=A.makeBackground(document,targets,L.hash);if(selected)updateRelationEdges();
}
function updateRelationEdges(){const members=relatedFilms(selected).map(f=>byId.get(f.id));relationEdges=relationMode==='series'?(seriesByFilm.get(selected?.id)?.edges||[]):members.filter(i=>films[i].id!==selected?.id).map(i=>({a:byId.get(selected.id),b:i}));}
function setHover(f){
 if(hovered?.id===f?.id)return;
 hovered=f;hoverSince=performance.now();hoverLevel=0;hoverGroup=f?seriesByFilm.get(f.id)||null:null;hoverSnapshot=f?{...(drifts[byId.get(f.id)]||{x:0,y:0})}:null;
 $('tooltip').hidden=!f;if(f)$('tooltip').textContent=filmName(f)+(f.year?' · '+f.year:'');requestDraw();
}
function drawConstellations(){
 let lines=0;
 // Every series uses the same screen-distance rule, including pairs and large series.
 if(expansion<.8)for(const g of seriesGroups)lines+=A.drawEdges(ctx,g.edges,point,visibleIndices,width,height,(.23/Math.max(1,Math.sqrt(zoom)))*(1-expansion),'#95a9bd',Math.min(90,width*.065));
 if(selected)lines+=A.drawEdges(ctx,relationEdges,point,visibleIndices,width,height,.23*A.smooth(Math.min(1,expansion*1.8)),relationMode==='series'?'#c4b58e':'#adc7d1');
 else if(hoverGroup&&hoverLevel>.01)lines+=A.drawEdges(ctx,hoverGroup.edges,point,visibleIndices,width,height,.38*hoverLevel,'#c4b58e');
 canvas.dataset.constellationLines=String(lines);canvas.dataset.hoverSeries=!selected&&hoverGroup&&hoverLevel>.5?hoverGroup.name:'';
}
function drawHoverLabels(){
 if(!hovered||selected)return;
 // A single full-title tooltip, never a cloud of truncated member labels.
 if(hoverLevel>.5){const visibleMembers=hoverGroup?.members.filter(i=>visibleIndices.has(i))||[];$('tooltip').textContent=filmName(hovered)+(hovered.year?' · '+hovered.year:'')+(hoverGroup?'\n'+seriesName(hovered)+' · '+visibleMembers.length+T(' 部可见 · 同系列'):'');}
}

// A continuous color disk and a luminous core read as one star, not five dots.
function drawStar(f,p,color,emphasized){
 const ready=!!f.colors?.length,metrics=G.starMetrics(width,zoom,starSizes.get(f.id)||1,ready,emphasized,height),r=metrics.radius,halo=metrics.halo,opacity=ctx.globalAlpha;
 const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);glow.addColorStop(0,color);glow.addColorStop(.18,color);glow.addColorStop(1,'transparent');ctx.globalAlpha=opacity*metrics.alpha;ctx.fillStyle=glow;ctx.fillRect(p.x-halo,p.y-halo,halo*2,halo*2);
 if(ready&&!starPalettes.has(f.id))starPalettes.set(f.id,Array.from({length:5},(_,k)=>L.starColor(f.colors[Math.min(f.colors.length-1,Math.floor((k+.5)/5*f.colors.length))])));
 ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
 if(ready){for(let k=0;k<5;k++){const a=k*Math.PI*2/5-Math.PI/2;ctx.fillStyle=starPalettes.get(f.id)[k];ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,r,a,a+Math.PI*2/5+.015);ctx.closePath();ctx.fill();}}
 const detail=ready?Math.max(0,Math.min(1,(zoom-1)/3)):0,coreRadius=r*(1-.35*detail);const core=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,coreRadius);core.addColorStop(0,'#f4f1df');core.addColorStop(.2,'#f4f1dfb0');core.addColorStop(.65,'#f4f1df18');core.addColorStop(1,'transparent');ctx.globalAlpha=opacity*(.7-.35*detail);ctx.fillStyle=core;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
}
function drawPlaceholder(f=selected,opacity=1){const p=ringPoint(),k=frameWidth()/1000,u=expansion*expansion*(3-2*expansion),outer=294*k*u,inner=202*k*u,start=-Math.PI/2+Math.PI/30,end=start+Math.PI*2-Math.PI/15;ctx.save();ctx.globalAlpha=u*opacity;const disk=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,outer+12*k);disk.addColorStop(0,'#0009');disk.addColorStop(.2,'#0009');disk.addColorStop(.5,'#0006');disk.addColorStop(.8,'#0002');disk.addColorStop(1,'transparent');ctx.fillStyle=disk;ctx.beginPath();ctx.arc(p.x,p.y,outer+12*k,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,outer,start,end);ctx.arc(p.x,p.y,inner,end,start,true);ctx.closePath();ctx.fillStyle='#8998ad0b';ctx.fill();ctx.strokeStyle='#8998ad55';ctx.lineWidth=.8;ctx.stroke();if(u>.95){ctx.font='12px Arial';ctx.textAlign='center';ctx.fillStyle='#aebbcf';ctx.fillText(filmName(f),p.x,p.y-8);ctx.font='10px Arial';ctx.fillStyle='#718098';ctx.fillText(T('尚未提取色彩'),p.x,p.y+16);}ctx.restore();}
function commitFilmFrame(frame,f){
 if(previousFrame){if(motionEnabled){preparedFrame={frame,f,ticket:frameToken};requestDraw();return;}previousFrame.remove();previousFrame=null;frameSwap=null;}
 const old=$('filmStage');old.id='filmStagePrevious';old.className='film-stage-buffer';old.style.pointerEvents='none';old.setAttribute('aria-hidden','true');old.inert=true;
 previousFrame=old;frame.id='filmStage';frame.removeAttribute('aria-hidden');frame.inert=false;frame.hidden=!f.viewer_url;frame.dataset.ready=String(!!f.viewer_url);incomingFrame=null;
 frameReveal=null;frameSwap={start:performance.now(),fromPlaceholder:displayedFilm&&!displayedFilm.viewer_url?displayedFilm:null};
 frameReady=frameOpened=!!f.viewer_url;pendingFilm=null;displayedFilm=f;
 showDetails(f);if(f.viewer_url)charts.setGallery(frame.contentWindow.FilmGallery);else charts.setEmpty(T('尚未采样，完成后显示时间曲线'));
 animateDetails();syncMotion();if(f.viewer_url)monitorFilm(frame,f,frameToken);$('stageStatus').hidden=true;requestDraw();
}
function monitorFilm(frame,f,ticket){
 if(ticket!==frameToken)return;const gallery=frame.contentWindow?.FilmGallery;if(!gallery)return;
 const state=gallery.getState();charts.update(state);I?.embedded(frame.contentDocument,f);
 if(openTarget&&frameOpened&&!state.target){closeFilm();return;}
 setTimeout(()=>monitorFilm(frame,f,ticket),100);
}
function mountFilm(f,staged=false){
 const ticket=++frameToken;let failed=false,frame=$('filmStage');
 if(staged){frame=document.createElement('iframe');frame.id='filmStageNext';frame.title=$('filmStage').title;frame.className='film-stage-buffer';frame.setAttribute('aria-hidden','true');frame.inert=true;frame.style.opacity='0';frame.style.pointerEvents='none';$('mapWrap').append(frame);incomingFrame=frame;}
 else{frameReady=false;frameOpened=false;frame.dataset.ready='false';frame.hidden=!f.viewer_url;charts.setEmpty(f.viewer_url?T('正在读取色彩曲线…'):T('尚未采样，完成后显示时间曲线'));displayedFilm=f;}
 frame.title=T('原版影片色环与截图');$('stageStatus').hidden=!f.viewer_url;$('stageStatus').textContent=T('正在读取色环…');
 if(!f.viewer_url){if(staged)commitFilmFrame(frame,f);else{frame.removeAttribute('src');pendingFilm=null;animateDetails();}return;}
 const fail=()=>{
  if(ticket!==frameToken||failed)return;failed=true;clearTimeout(deadline);
  if(staged){discardIncoming();pendingFilm=null;const from=focusAnchor?{...focusAnchor}:worldPosition(displayedFilm);selected=displayedFilm;panTween={from,start:performance.now()};updateRelationEdges();monitorFilm($('filmStage'),displayedFilm,ticket);}
  $('stageStatus').textContent=T('色环加载失败，请重选影片重试');$('stageStatus').hidden=false;
  if(!staged)charts.setEmpty(T('色彩曲线暂不可用，请重新选片'));requestDraw();
 };
 const deadline=setTimeout(()=>{if(ticket===frameToken&&((staged&&incomingFrame===frame)||(!staged&&!frameReady)))fail();},30000);
 cancelLoad=()=>{failed=true;clearTimeout(deadline);};
 frame.onerror=fail;
 frame.onload=()=>{
  if(ticket!==frameToken)return;
  let doc;try{doc=frame.contentDocument;if(!doc?.documentElement)throw Error('Missing frame document');const style=doc.createElement('style');doc.documentElement.dataset.embeddedAtlas='true';style.textContent='html,body{background:transparent!important;color-scheme:normal!important;overflow:hidden}body>nav,main>header,.inspector,.viewhead,#motionStatus,.stagefoot,.charts,.explore,main>details,main>footer{display:none!important}main{padding:0!important;max-width:none!important}.workspace{display:block!important;padding:0!important}.stagewrap{margin:0!important}#stage{background:none!important}';doc.head.append(style);}catch(_){fail();return;}
  const poll=()=>{
   if(ticket!==frameToken||failed)return;const child=frame.contentWindow,gallery=child?.FilmGallery;
   if(!gallery){setTimeout(poll,80);return;}
   clearTimeout(deadline);
   if(!staged){frameReady=true;charts.setGallery(gallery);syncMotion();monitorFilm(frame,f,ticket);requestDraw();return;}
   // Prepare the replacement offscreen; the current ring and inspector stay visible.
   if(gallery.getState().motionEnabled)doc.getElementById('motion').click();
   gallery.open(0);I?.embedded(doc,f);
   const readyAt=performance.now(),poster=typeof Image==='function'?new Image():null;if(poster&&f.poster){poster.crossOrigin='anonymous';poster.src=f.poster;}
   const reveal=()=>{if(ticket!==frameToken||failed)return;const preview=doc.getElementById('centralPreview');if(performance.now()-readyAt<8000&&((preview?.dataset.loading==='true')||(poster&&f.poster&&!poster.complete))){setTimeout(reveal,50);return;}
   child.requestAnimationFrame(()=>child.requestAnimationFrame(()=>{
    if(ticket!==frameToken||!openTarget||incomingFrame!==frame)return;
    commitFilmFrame(frame,f);
   }));};reveal();
  };poll();
 };
 frame.src=f.viewer_url+'&embedded=atlas';
}
function closeFilm(){if(!openTarget)return;setHover(null);discardIncoming();pendingFilm=null;switchStarted=null;panTween=null;++frameToken;const gallery=frameReady&&$('filmStage').contentWindow?.FilmGallery;if(gallery)gallery.close();transitionTo(0);$('stageStatus').hidden=true;requestDraw();}
// A bottom sheet changes only the focused presentation plane, never the overview camera.
function sheetGeometryForViewport(viewWidth,viewHeight,fullFrameWidth,availableBottom){
 const bottom=Math.max(1,Math.min(viewHeight,availableBottom)-12),top=Math.min(52,Math.max(0,bottom-64)),available=Math.max(1,bottom-top);
 return{width:Math.min(fullFrameWidth,available/.73),y:top+available/2};
}
function measureSheetGeometry(){
 sheetMeasureFrame=0;const active=innerWidth<=740&&!!openTarget&&document.body.classList.contains('sheet-open'),normal={width:Math.min(Math.max(1,width-2*focusShift)*(innerWidth<=740?1.45:1),height/.73),y:height/2+20};
 const target=active?sheetGeometryForViewport(width,height,normal.width,$('details').getBoundingClientRect().top-$('mapWrap').getBoundingClientRect().top):normal;
 const oldTarget=sheetTween?.to||mobileSheetGeometry||normal;if(Math.abs(oldTarget.width-target.width)<.5&&Math.abs(oldTarget.y-target.y)<.5&&(!sheetTween||sheetTween.active===active))return;
 if(!motionEnabled){mobileSheetGeometry=active?target:null;sheetTween=null;}else{sheetTween={from:mobileSheetGeometry?{...mobileSheetGeometry}:normal,to:target,active,start:performance.now()};}
 canvas.dataset.sheetFocus=active?'compact':'normal';requestDraw();
}
function scheduleSheetGeometry(){if(!sheetMeasureFrame)sheetMeasureFrame=requestAnimationFrame(measureSheetGeometry);}
function updateSheetGeometry(now){if(!sheetTween)return;const t=motionEnabled?Math.min(1,(now-sheetTween.start)/320):1,u=A.smooth(t),{from,to}=sheetTween;mobileSheetGeometry={width:from.width+(to.width-from.width)*u,y:from.y+(to.y-from.y)*u};if(t===1){if(!sheetTween.active)mobileSheetGeometry=null;sheetTween=null;}}
function refit(){cameraFit=G.fit(targets,width,height,{left:width<=740?18:34,right:width<=740?18:34,top:width<=740?66:76,bottom:width<=740?62:58});}
function resize(){
 const previous=camera(),world=G.worldAt(previous,previous.origin),atFit=zoom===1&&Math.abs(pan.x)<.1&&Math.abs(pan.y)<.1;
 cancelGesture();dismissHits();const rect=$('mapWrap').getBoundingClientRect();width=rect.width;height=rect.height;refit();
 if(!atFit){const next=G.anchor(camera(),world,cameraFit.origin,zoom);pan=next.pan;}
 canvasSizeDirty=true;focusShift=getComputedStyle($('details')).position==='absolute'?Math.min(width*.35,($('details').getBoundingClientRect().width+24)/2):0;const fw=frameWidth();$('filmStage').style.width=fw+'px';$('filmStage').style.height=fw*.73+'px';scheduleSheetGeometry();requestDraw();
}
function setLayout(next){mode=next;facet='';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('explanation').textContent=T(description[mode])+T(' 淡线连接同系列影片；悬浮停留查看星座，选片后可切换同系列 / 同导演。');$('explanation').title=$('explanation').textContent;updateFacets();filter();if(!layoutLoaded){layoutLoaded=true;const current=++token;$('layoutStatus').textContent=T('正在计算综合关系…');if(worker)worker.postMessage({token:current,films,mode:'combined'});else setTimeout(()=>receive({token:current,...L.layout(films,'combined'),starSizes:L.associationSizes(films)}),0);}requestDraw();}
function receive(data){if(data.token!==token)return;if(data.error){$('layoutStatus').textContent=T('布局计算失败，请刷新重试');return;}if(data.starSizes)films.forEach((f,i)=>starSizes.set(f.id,data.starSizes[i]));targets=data.positions;refit();tourLayoutReady=true;labels=[];edges=data.edges;rebuildAtmosphere();if(!positions.length)positions=targets.map(p=>({...p}));$('layoutStatus').textContent='';requestDraw();}
function facetCounts(){const counts=new Map();for(const f of films)for(const key of L.values(f,mode)){if(!counts.has(key))counts.set(key,{n:0,f});counts.get(key).n++;}return [...counts].sort(mode==='year'?(a,b)=>a[0].localeCompare(b[0]):(a,b)=>b[1].n-a[1].n||a[0].localeCompare(b[0]));}
function updateFacets(){const select=$('facet');select.replaceChildren();const all=document.createElement('option');all.value='';all.textContent=T('全部')+(mode==='combined'?T('类型'):T(viewNames[mode]));select.append(all);for(const [key,v] of facetCounts()){const o=document.createElement('option');o.value=key;o.textContent=facetName(v.f,mode,key)+' · '+v.n;select.append(o);}select.value=facet;}
function updateLegend(){const top=facetCounts().slice(0,mode==='year'?30:8);$('legend').replaceChildren(...top.map(([key,v])=>{const b=document.createElement('button'),dot=document.createElement('i');b.type='button';b.setAttribute('aria-pressed',String(facet===key));dot.style.background=mode==='combined'?'#aebbcf':L.color(mode==='year'?{...v.f,year:parseInt(key,10)}:L.facetFilm(v.f,mode,key),mode);b.append(dot,document.createTextNode(facetName(v.f,mode,key)+' '+v.n));b.onclick=()=>{facet=facet===key?'':key;$('facet').value=facet;filter();};return b;}));}
function filter(){dismissHits();setHover(null);const q=$('search').value.trim().normalize('NFKC').toLowerCase();visible=films.filter(f=>L.matches(f,mode,facet)&&(!q||(I?I.searchText(f):[f.title,f.original_title,f.series,f.year,...f.genres,...f.countries,...f.directors].join(' ').toLowerCase()).includes(q)));visibleIndices=new Set(visible.map(f=>byId.get(f.id)));transitionFacets();$('mapCount').hidden=visible.length===films.length;$('mapCount').textContent=visible.length+' / '+films.length+T(' 部影片');$('listCount').textContent='('+visible.length+')';$('empty').hidden=!!visible.length;$('filmList').replaceChildren(...visible.map(f=>{const b=document.createElement('button');b.textContent=filmName(f)+(f.year?' · '+f.year:'');b.onclick=()=>{document.querySelector('.catalog').open=false;choose(f,true);};return b;}));updateLegend();if(motionEnabled)$('legend').animate?.([{opacity:.4,transform:'translateY(4px)'},{opacity:.65,transform:'translateY(0)'}],{duration:420,easing:'ease-out'});document.dispatchEvent(new CustomEvent('atlas:filtered',{detail:{films:visible,total:films.length,query:$('search').value,selectedId:selected?.id}}));requestDraw();}
function showDetails(f){$('welcome').hidden=true;$('filmDetails').hidden=false;$('filmTitle').textContent=filmName(f);if($('metadataFallback')){$('metadataFallback').textContent=T('部分译名待补全');$('metadataFallback').title=T('译名未补齐的资料保留原文');$('metadataFallback').hidden=!!f.metadata_v2&&f.metadata_v2.title[I?.locale||'zh']&&['genres','countries','directors'].every(k=>f.metadata_v2[k].every(e=>e.labels[I?.locale||'zh']));}$('filmYear').textContent=[f.year?String(f.year):T('年份未知'),I?.runtime(f)||(f.runtime?f.runtime+T(' 分钟'):'')].filter(Boolean).join(' · ');$('filmYear').title=T(f.runtime_source==='local_measured'?'影片时长来自本地文件实测。':'影片时长为资料参考值；色环按本地影片实际时间显示。');$('statusBadge').textContent=T(f.color_status==='ready'?'色彩已就绪':'等待色彩采样');const img=$('poster');img.hidden=!f.poster;if(f.poster){img.crossOrigin='anonymous';img.src=f.poster;img.alt=filmName(f)+T(' 海报');img.onerror=()=>{img.hidden=true;};}else img.removeAttribute('src');const pairs=[[T('类型'),terms(f,'genres').join(' / ')],[T('地区'),terms(f,'countries').join(' / ')],[T('导演'),terms(f,'directors').join(' / ')]];$('info').replaceChildren(...pairs.filter(p=>p[1]).flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return[dt,dd];}));if($('metadataSource'))$('metadataSource').textContent=T(f.metadata_provenance?.source==='TMDB'?'资料采用已匹配的 TMDB 缓存；缺译名保留原文。年份按首映日期、地区按制片地区，未标注的时长为参考值；“本地实测”来自影片文件，色环使用本地实测时间轴。原影片、NFO 和海报保持只读。':'资料来自本地 NFO，未经独立核实。影片、NFO 和原海报保持只读。');$('viewerLink').hidden=!f.viewer_url;if(f.viewer_url)$('viewerLink').href=f.viewer_url;else $('viewerLink').removeAttribute('href');showRelated(f);$('issues').textContent=f.issues.length?T('资料有缺项，等待核实'):'';}
function showRelated(f){
 updateRelationEdges();document.querySelectorAll('[data-relation]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.relation===relationMode)));
 const related=relatedFilms(f).sort((a,b)=>(a.year||9999)-(b.year||9999)||a.id.localeCompare(b.id)),others=related.filter(x=>x.id!==f.id),known=!!(f.local_association||f.series||f.series_id);
 const zh=I?.locale!=='en';
 $('seriesTitle').textContent=relationMode==='series'?(known?seriesName(f)+' · '+(zh?'本片集 ':'In this collection: ')+related.length+T(' 部'):T('系列信息暂缺')):T('本片集中同导演作品')+' · '+related.length+T(' 部');
 $('relationHint').textContent=others.length?'':relationMode==='series'?(known?T('本片集暂仅收录该系列这一部'):''):T('本片集暂无其他已识别的同导演作品');
 $('relationHint').style.display=$('relationHint').textContent?'block':'none';document.querySelector('.related').dataset.empty=String(!others.length);
 $('seriesList').replaceChildren(...(others.length?related:[]).map(other=>{const b=document.createElement('button');b.textContent=filmName(other)+(other.year?' · '+other.year:'');if(other.id===f.id){b.className='active';b.setAttribute('aria-current','true');}b.onclick=()=>choose(other);return b;}));
}

function choose(f){dismissHits();cancelGesture();if(selected?.id===f.id&&openTarget)return;const switching=!!selected&&!!openTarget,returning=!!selected&&!openTarget;skipUnfold=switching;const from=focusAnchor?{...focusAnchor}:null;selected=f;setHover(null);if(switching||returning){panTween={from:from||worldPosition(f),start:performance.now()};if(returning)transitionTo(1);}else{focusAnchor=worldPosition(f);panTween=null;expansion=0;transitionTo(1);}updateRelationEdges();queueFilm(f,switching);document.dispatchEvent(new CustomEvent('atlas:selected',{detail:{film:f}}));requestDraw();}
function candidates(x,y,touch=false){return G.hitCandidates(visible.map(f=>{const p=point(byId.get(f.id));return{id:f.id,f,...p,radius:G.starMetrics(width,zoom,starSizes.get(f.id)||1,!!f.colors?.length,false,height).radius};}),{x,y},touch);}
function hit(x,y){return candidates(x,y)[0]?.f||null;}
function dismissHits(){hitMenu?.remove();hitMenu=null;}
function showHits(hits,p){
 dismissHits();const menu=document.createElement('section');menu.className='atlas-hit-candidates';menu.setAttribute('aria-label',T('选择附近影片'));menu.style.cssText='position:absolute;z-index:35;width:min(300px,calc(100% - 24px));max-height:min(280px,55%);overflow:auto;overscroll-behavior:contain;padding:10px;background:#18191bf2;border:1px solid #626264;border-radius:10px;box-shadow:0 8px 30px #0008;';
 menu.style.left=Math.max(12,Math.min(width-312,p.x-140))+'px';menu.style.top=Math.max(62,Math.min(height-300,p.y+20))+'px';
 const heading=document.createElement('p');heading.textContent=T('多部影片相邻，请选择或放大');heading.style.cssText='margin:0 0 6px;color:#d6d3cc;font-size:12px';menu.append(heading);
 const close=document.createElement('button');close.textContent=T('关闭');close.style.cssText='min-height:44px;margin-bottom:5px;';close.onclick=()=>{dismissHits();canvas.focus({preventScroll:true});};menu.append(close);
 for(const item of hits){const b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;min-height:44px;text-align:left;margin:3px 0;';b.textContent=filmName(item.f)+(item.f.year?' · '+item.f.year:'');b.onclick=()=>choose(item.f);menu.append(b);}
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();dismissHits();canvas.focus({preventScroll:true});}});$('mapWrap').append(menu);hitMenu=menu;close.focus({preventScroll:true});
}
function coords(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function applyCamera(next){zoom=next.zoom;pan=next.pan;requestDraw();}
function zoomAt(value,x=cameraFit.origin.x,y=cameraFit.origin.y){dismissHits();applyCamera(G.zoomAt(camera(),value,{x,y}));}
const gesture=G.createController(camera,applyCamera);
function cancelGesture(){const ids=gesture.ids();gesture.cancel();drag=null;for(const id of ids)try{if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch(_){};}
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=coords(e);zoomAt(zoom*Math.exp(-e.deltaY*.001),p.x,p.y);},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;dismissHits();setHover(null);gesture.down(e.pointerId,coords(e));drag={id:e.pointerId};try{canvas.setPointerCapture(e.pointerId);}catch(_){};});
canvas.addEventListener('pointermove',e=>{const p=coords(e);if(gesture.move(e.pointerId,p))return;if(e.pointerType==='touch')return;setHover(hit(p.x,p.y));$('tooltip').hidden=!hovered;if(hovered){if(hoverLevel<.5)$('tooltip').textContent=filmName(hovered)+(hovered.year?' · '+hovered.year:'');$('tooltip').style.left=Math.max(4,Math.min(width-300,p.x+15))+'px';$('tooltip').style.top=Math.max(65,Math.min(height-85,p.y+15))+'px';}requestDraw();});
canvas.addEventListener('pointerup',e=>{const p=coords(e),result=gesture.end(e.pointerId,p);drag=gesture.active()?drag:null;try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch(_){};if(!result.tap)return;const hits=candidates(p.x,p.y,e.pointerType==='touch');setHover(null);if(openTarget){const f=hits[0]?.f;if(f&&relatedFilms(selected).some(x=>x.id===f.id))choose(f);else closeFilm();}else if(hits.length>1&&e.pointerType==='touch')showHits(hits,p);else if(hits.length)choose(hits[0].f);});
for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(gesture.has(e.pointerId))cancelGesture();});
canvas.addEventListener('pointerleave',()=>{setHover(null);requestDraw();});canvas.addEventListener('keydown',e=>{if(e.key==='Escape')$('clear').click();if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(zoom*1.2);}if(e.key==='-'){e.preventDefault();zoomAt(zoom/1.2);}});
window.addEventListener('blur',cancelGesture);window.addEventListener('orientationchange',cancelGesture);
document.querySelectorAll('[data-relation]').forEach(b=>b.onclick=()=>{relationMode=b.dataset.relation;if(selected){showRelated(pendingFilm?displayedFilm:selected);if(motionEnabled)$('seriesList').animate?.([{opacity:.82,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,easing:'ease-out'});}requestDraw();});
$('zoomIn').onclick=()=>zoomAt(zoom*1.25);$('zoomOut').onclick=()=>zoomAt(zoom/1.25);$('reset').onclick=()=>{cancelGesture();dismissHits();closeFilm();pan={x:0,y:0};zoom=1;requestDraw();};$('clear').onclick=closeFilm;$('collapse').onclick=closeFilm;document.addEventListener('keydown',e=>{if(e.key==='Escape'){dismissHits();closeFilm();}});$('motion').onclick=()=>{motionOverride=true;motionEnabled=!motionEnabled;syncMotion();};reduced.addEventListener('change',()=>{if(!motionOverride){motionEnabled=!reduced.matches;syncMotion();}});document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();lastDraw=0;requestDraw();});$('facet').onchange=()=>{facet=$('facet').value;filter();};$('search').oninput=filter;document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setLayout(b.dataset.mode));new ResizeObserver(resize).observe($('mapWrap'));
new ResizeObserver(scheduleSheetGeometry).observe($('details'));
new MutationObserver(scheduleSheetGeometry).observe(document.body,{attributes:true,attributeFilter:['class']});
$('mobileSheetToggle')?.addEventListener('click',scheduleSheetGeometry);

function updateStats(){$('stats').hidden=true;const rows=[[films.length,'部影片'],[new Set(films.filter(f=>f.series).map(L.seriesKey).filter(Boolean)).size,'个系列'],[films.filter(f=>f.color_status==='ready').length,'部已有色彩']];$('stats').replaceChildren(...rows.map(([n,t])=>{const span=document.createElement('span'),strong=document.createElement('strong');strong.textContent=n;span.append(strong,document.createTextNode(T(t)));return span;}));}
function refreshLanguage(){
 if(!I)return;document.documentElement.lang=I.locale==='en'?'en':'zh-CN';document.title=T('影色星图');I.apply(document.body);for(const frame of [$('filmStage'),incomingFrame,previousFrame].filter(Boolean))frame.title=T('原版影片色环与截图');updateStats();$('language').value=I.locale;updateFacets();filter();syncMotion();$('explanation').textContent=T(description[mode])+T(' 淡线连接同系列影片；悬浮停留查看星座，选片后可切换同系列 / 同导演。');$('explanation').title=$('explanation').textContent;if(tourLayoutReady)$('layoutStatus').textContent='';if(selected)showDetails(pendingFilm?displayedFilm:selected);if(!frameReady)charts.setEmpty(T(selected?.viewer_url?'正在读取色彩曲线…':selected?'尚未采样，完成后显示时间曲线':'选择影片查看时间曲线'));charts.refresh?.();if(frameReady&&displayedFilm)I.embedded($('filmStage').contentDocument,displayedFilm);requestDraw();
}
if($('language'))$('language').onchange=()=>{I.setLocale($('language').value);refreshLanguage();};

function installTour(){
 if(!window.LibraryTour)return;let demo=null;
 function reset(view={}){setHover(null);closeFilm();pan=view.pan?{...view.pan}:{x:0,y:0};zoom=view.zoom||1;relationMode=view.relationMode||'series';$('search').value=view.search||'';setLayout(view.mode||'genres');facet=view.facet||'';$('facet').value=facet;filter();document.querySelector('.catalog').open=false;if(view.selected){const f=films.find(x=>x.id===view.selected);if(f)choose(f);}requestDraw();}
 function showFilm(relation='series'){if(!demo)return;relationMode=relation;choose(demo);if(selected)showRelated(selected);requestDraw();}
 window.LibraryTour.create({
 snapshot:()=>({selected:openTarget?selected?.id:null,pan:{...pan},zoom,mode,facet,relationMode,search:$('search').value}),
 begin(){demo=window.LibraryTour.pickFilm(films,L.associationKey);reset();},
 present(step){
  if(step==='overview'||step==='size'||step==='finish'){reset();return;}
  if(step==='links'){closeFilm();setHover(demo);$('tooltip').hidden=true;return;}
  if(step==='facets'){reset();setLayout('countries');return;}
  if(step==='legend'){reset();const key=demo?L.values(demo,'genres')[0]:null;facet=key||'';$('facet').value=facet;filter();return;}
  showFilm(step==='directors'?'directors':'series');
 },
 settled(step){if(!tourLayoutReady||animating||morph||panTween||pendingFilm||frameSwap||frameReveal||facetTransition)return false;if(step==='links')return !selected&&(!demo||hoverLevel>.9);if(['ring','info','series','directors','charts'].includes(step))return !!selected&&expansion===1&&(!demo?.viewer_url||($('filmStage').dataset.ready==='true'&&frameOpened));return !selected;},
 seriesRect(){if(!demo)return null;const group=seriesByFilm.get(demo.id),ids=group?.members||[byId.get(demo.id)],points=ids.map(point),r=canvas.getBoundingClientRect(),left=Math.min(...points.map(p=>p.x))+r.left-22,right=Math.max(...points.map(p=>p.x))+r.left+22,top=Math.min(...points.map(p=>p.y))+r.top-22,bottom=Math.max(...points.map(p=>p.y))+r.top+22;return {left,right,top,bottom,width:right-left,height:bottom-top};},
 note(step){if(!demo)return T('片库暂无可演示影片，你可以先了解操作方式。');if(['ring','charts'].includes(step)&&!demo.viewer_url)return T('示例影片尚未采样，完成处理后会显示真实色环和曲线。');if(step==='links'&&!seriesByFilm.has(demo.id))return T('示例影片暂无明确系列资料；有系列的影片会显示关联连线。');if(step==='directors'&&relatedFilms(demo).length<2)return T('这部影片目前没有更多已识别的同导演作品。');if(step==='facets')return T('演示中：按地区着色。');if(step==='legend')return facet?T('演示中：已筛选 ')+facetName(demo,'genres',facet)+(I?.locale==='en'?'.':'。'):'';return ['ring','info','series','directors','charts','links'].includes(step)?T('示例影片：')+filmName(demo):'';},
 end(view){reset(view?.overview?{}:view||{});}
 });
}

window.LibraryExperienceBridge={choose,getFilms:()=>films,getSelected:()=>selected};
try{const data=await AtlasDeployment.index();films=data.films;films.forEach((f,i)=>byId.set(f.id,i));updateStats();positions=films.map((f,i)=>({x:1000+Math.cos(i)*200,y:650+Math.sin(i)*200}));targets=positions.map(p=>({...p}));try{worker=new Worker(AtlasDeployment.site('library-layout.js?v=ui20261023-01'));worker.onmessage=e=>receive(e.data);worker.onerror=()=>{$('layoutStatus').textContent=T('后台布局失败，请刷新重试');};}catch(e){worker=null;}setLayout(mode);syncMotion();resize();refreshLanguage();installTour();}catch(error){$('stats').hidden=false;$('stats').textContent=T('片库暂时无法读取，请刷新重试。');$('layoutStatus').textContent=T('未加载');}
})();
