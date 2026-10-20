let film=films[0];
const $=id=>document.getElementById(id),TAU=Math.PI*2;
let S=film.samples,N=S.length,T=film.display_duration_s;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,fmt=t=>{const v=Math.max(0,Math.floor(t)),h=Math.floor(v/3600),m=Math.floor(v%3600/60),s=v%60;return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};
let B=S.map(s=>(.2126*s.rgb[0]+.7152*s.rgb[1]+.0722*s.rgb[2])/255),D=S.map((s,i)=>i?Math.hypot(...s.rgb.map((v,k)=>v-S[i-1].rgb[k])):0),DM=Math.max(1,...D);
const fmtExtent=t=>fmt(t)+(Number.isInteger(t)?'':(t%1).toFixed(2).slice(1));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected=Math.floor(N*.4),focus=selected,progress=0,target=0,transition=null,raf=0,replayPending=false,hits=[],touchId=null,lastNow=0,disposed=false;
const FOCUS_ZOOM=1.18;
const nodes=[{x:.5,y:.5}];
let movieIndex=0,galleryFocus=0,galleryHover=-1,pendingMovie=null;
const savedSelection=films.map(f=>Math.floor(f.samples.length*.4));
let anchor={...nodes[0]};
let geometryKey='',ambientStrength=1,morphVelocity=0;
const nodeOffsets=nodes.map(()=>({x:0,y:0,start:0}));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
let motionOverride=false,motionEnabled=!reduced.matches,lastInteraction=-10000,lastPaint=-Infinity,ambientTime=0;
const peripheralIds=['explore','filmMeta','inspector','charts','stagefoot','notes','credits','replay'];
// Seed once. Slow sinusoidal offsets are decoration only; interactive geometry never drifts.
let seed=713;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const motes=Array.from({length:32},()=>({x:35+random()*930,y:35+random()*535,r:.35+random()*.55,phase:random()*TAU,speed:.15+random()*.18}));
// Average-color distance only; not semantic image similarity.
function rgbToLab(rgb){const [r,g,b]=rgb.map(v=>{v=clamp(Number(v)||0,0,255)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});const f=t=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116;const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);return[116*y-16,500*(x-y),200*(y-z)]}
function rankSamples(samples,ref){const labs=samples.map(s=>rgbToLab(s.rgb)),base=labs[ref];const distances=labs.map(l=>Math.hypot(...l.map((v,k)=>v-base[k])));const order=samples.map((_,i)=>i).sort((a,b)=>distances[a]-distances[b]||(a===ref?-1:b===ref?1:samples[a].time_s-samples[b].time_s||a-b));return{distances,order}}
const ECHO_THRESHOLD=40,ECHO_EXCLUSION=120,ECHO_LIMIT=10;
const ORBIT_START=-Math.PI/2+Math.PI/30,ORBIT_SWEEP=TAU-Math.PI/15;
let reference=selected,sortMode='chronological',order=S.map((_,i)=>i),distances=[],positions=S.map(s=>[s.time_s/T,s.end_s/T]),sortTransition=null,positionRevision=0;
let echoesEnabled=true,circleCrop=true,echoResult=null;
function colorEchoes(samples,ref,{threshold=ECHO_THRESHOLD,exclusion=ECHO_EXCLUSION,episodeGap=Math.max(12,(film.sample_interval_s||0)*1.1),limit=ECHO_LIMIT}={}){const ranked=rankSamples(samples,ref),eligible=ranked.order.filter(i=>i!==ref&&Math.abs(samples[i].time_s-samples[ref].time_s)>exclusion&&ranked.distances[i]<=threshold).sort((a,b)=>samples[a].time_s-samples[b].time_s||a-b),episodes=[];for(const id of eligible){let ep=episodes.at(-1);if(!ep||samples[id].time_s-samples[ep.ids.at(-1)].time_s>episodeGap){ep={ids:[]};episodes.push(ep)}ep.ids.push(id)}const all=episodes.map(ep=>{const id=ep.ids.slice().sort((a,b)=>ranked.distances[a]-ranked.distances[b]||samples[a].time_s-samples[b].time_s||a-b)[0];return{id,start:samples[ep.ids[0]].time_s,end:samples[ep.ids.at(-1)].time_s,count:ep.ids.length,distance:ranked.distances[id],gap:samples[id].time_s-samples[ref].time_s}});return{eligibleCount:eligible.length,totalEpisodes:all.length,episodes:all.sort((a,b)=>a.distance-b.distance||a.start-b.start).slice(0,limit).sort((a,b)=>a.start-b.start),distances:ranked.distances}}
function neighbor(step){return clamp(selected+step,0,N-1)}
function resetSimilarity(){reference=selected;sortMode='chronological';order=S.map((_,i)=>i);positions=S.map(s=>[s.time_s/T,s.end_s/T]);sortTransition=null;positionRevision++;echoesEnabled=true;circleCrop=true;updateReference();updateCentral()}
function advanceSort(){} // Time is never reordered in the gallery.
function setSort(){sortMode='chronological';sortTransition=null;updateSortLabels();queue()}
function pinReference(i=selected){select(i);if(previewIndex!==selected){previewIndex=selected;preview(S[selected]);}const next=clamp(i,0,N-1);if(next!==reference)beginReferenceTransition();reference=next;updateReference();updateCentral();$('announce').textContent=`参照已固定为 ${fmt(S[reference].time_s)}，${echoResult.episodes.length} 个跨时段颜色候选`;queue()}
function updateSortLabels(){document.body.dataset.sort='chronological';$('prev').setAttribute('aria-label','上一个时间采样');$('next').setAttribute('aria-label','下一个时间采样');$('similar').setAttribute('aria-pressed',String(echoesEnabled));$('similar').textContent=echoesEnabled?'色彩回声 · 开':'色彩回声 · 关';$('sortStatus').textContent=`时间始终顺时针，不重排。ΔE76 ≤ 40 · 排除前后 120 秒（含边界）· 每个候选时段选一帧，最多 10 帧。当前 ${echoResult?.episodes.length||0} 帧。`;if(target)$('direction').textContent=`顺时针 · ${N} 个真实采样 · 12° 缺口`;updatePreviewRank()}
function updatePreviewRank(){if(!distances.length)return;$('previewRank').textContent=`当前预览 · ΔE76 ${distances[selected].toFixed(2)}${selected===reference?' · 固定参照':''}`}
function updateReference(){echoResult=colorEchoes(S,reference);distances=echoResult.distances;$('referenceImage').src=S[reference].image;$('referenceImage').alt=`${film.title} ${fmt(S[reference].time_s)} 固定参照`;$('referenceText').textContent=`固定参照 ${fmt(S[reference].time_s)} · ${S[reference].hex.toUpperCase()} · ΔE76 0.00。悬浮预览不会改变参照。`;satellites=satelliteLayout(echoResult.episodes);renderSatellites();$('matches').innerHTML=echoResult.episodes.length?echoResult.episodes.map(ep=>`<button class="match-text" data-sample="${ep.id}">${fmt(S[ep.id].time_s)} · ΔE76 ${ep.distance.toFixed(2)} · 时段 ${fmt(ep.start)}—${fmt(ep.end)} · 固定参照</button>`).join(''):'<p class="empty-echo">这个参照没有符合条件的跨时段颜色候选。</p>';updateSortLabels();drawCharts()}
// Keep every satellite on its exact timestamp ray. Only radius and a shared size may vary.
let satellites=[],satellitePointer=null,satelliteClick=null;
let referenceTransition=null,frameTransition=null,displayedFrame=null;
const timelineListeners=new Set();
function notifyTimeline(){if(!timelineListeners.size||!window.FilmGallery)return;const state=window.FilmGallery.getState();for(const listener of timelineListeners)listener(state);}
const FRAME_DURATION=160,REFERENCE_DURATION=220;
// Retain exact source-over groups, prune visually negligible branches, and
// collapse single-child groups so rapid input cannot grow an unbounded DOM tree.
function snapshotBlend(previous,html,mix){
 const root={opacity:1,children:[...(previous?[{...previous,opacity:previous.opacity*(1-mix)}]:[]),{opacity:mix,html}]};
 function prune(node,weight=1){const effective=weight*node.opacity;if(effective<.003)return null;if(node.html!==undefined)return node;const children=node.children.map(child=>prune(child,effective)).filter(Boolean);if(!children.length)return null;if(children.length===1)return{...children[0],opacity:node.opacity*children[0].opacity};return{...node,children}}
 return prune(root);
}
function snapshotHTML(node){if(!node)return '';return `<div style="position:absolute;inset:0;opacity:${node.opacity}">${node.html===undefined?node.children.map(snapshotHTML).join(''):node.html}</div>`}
function beginReferenceTransition(){
  if(!motionEnabled||!target||progress<.995)return;
  const mix=referenceMix(),tree=snapshotBlend(referenceTransition?.tree,$('satellites').innerHTML,mix),layers=referenceTransition?referenceTransition.layers.map(layer=>({...layer,weight:layer.weight*(1-mix)})):[];
  layers.push({reference,paths:echoPaths(),guides:satelliteGuideSegments(),html:$('satellites').innerHTML,weight:mix});
  referenceTransition={start:performance.now(),tree,layers:layers.filter(layer=>layer.weight>.001)};
  const ghost=$('satellitesPrevious');ghost.innerHTML=snapshotHTML(tree);ghost.inert=true;ghost.setAttribute('aria-hidden','true');
}
function referenceMix(now=performance.now()){return referenceTransition?smooth((now-referenceTransition.start)/REFERENCE_DURATION):1}
function finishFrameTransition(){frameTransition=null;$('centralFramePrevious').style.opacity='0';$('centralFramePrevious').innerHTML='';$('centralFrame').style.opacity='1'}
function clearDetailTransitions(){referenceTransition=null;$('satellitesPrevious').innerHTML='';$('satellitesPrevious').style.opacity='0';finishFrameTransition()}
function advanceDetails(now){
  if(referenceTransition&&(!motionEnabled||now-referenceTransition.start>=REFERENCE_DURATION)){referenceTransition=null;$('satellitesPrevious').innerHTML=''}
  if(frameTransition){const t=motionEnabled?smooth((now-frameTransition.start)/FRAME_DURATION):1;$('centralFramePrevious').style.opacity=String(1-t);$('centralFrame').style.opacity=String(t);if(t===1)finishFrameTransition()}
}

function satelliteLayout(episodes){
  for(const size of [42,38,34,30,26,22,18]){
    const minR=80+size/2+10,maxR=164-size/2;
    const lanes=[minR,maxR,(minR+maxR)/2,lerp(minR,maxR,.25),lerp(minR,maxR,.75)];
    const choices=episodes.map(ep=>{const angle=ORBIT_START+S[ep.id].time_s/T*ORBIT_SWEEP;return lanes.map(r=>({id:ep.id,angle,r,size,x:500+Math.cos(angle)*r,y:350+Math.sin(angle)*r}))});
    const placed=[];
    function place(i){if(i===choices.length)return true;for(const p of choices[i]){if(placed.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=size+10)){placed.push(p);if(place(i+1))return true;placed.pop()}}return false}
    if(place(0))return placed;
  }
  if(!episodes.length)return [];const weakest=episodes.reduce((a,b)=>a.distance>b.distance?a:b);return satelliteLayout(episodes.filter(ep=>ep.id!==weakest.id));
}
function renderSatellites(){
  satellitePointer=null;satelliteClick=null;
  $('satellites').innerHTML=satellites.map(p=>{const ep=echoResult.episodes.find(e=>e.id===p.id),description=`${fmt(S[p.id].time_s)} · ΔE76 ${ep.distance.toFixed(2)}`;return `<button class="satellite" data-sample="${p.id}" style="left:${p.x/10}%;top:${p.y/7.3}%;width:${p.size/10}%;--tone:${S[p.id].hex}" aria-label="${safe(film.title)} ${description}，点击固定为参照"><img crossorigin="anonymous" src="${hdFrame(S[p.id])}" alt="" draggable="false"><span class="satellite-label">${description}</span></button>`}).join('');
}
function syncSatellites(){const visible=!!target&&progress>=.995&&!transition&&echoesEnabled;const el=$('satellites');el.inert=!visible;el.setAttribute('aria-hidden',String(!visible));el.style.visibility=visible?'visible':'hidden';el.style.opacity=visible?String(referenceMix()):'0';const ghost=$('satellitesPrevious');ghost.style.visibility=visible&&referenceTransition?'visible':'hidden';ghost.style.opacity=visible&&referenceTransition?String(1-referenceMix()):'0'}
function updateCentral(){const el=$('centralPreview');el.dataset.crop=circleCrop?'circle':'full';$('circleToggle').textContent=circleCrop?'查看完整画幅':'圆形裁切';$('circleToggle').setAttribute('aria-pressed',String(!circleCrop));$('centralTime').textContent=displayedFrame?fmt(displayedFrame.time):'—';$('centralState').textContent=$('centralPreview').dataset.loading==='true'?`正在加载 ${fmt(S[reference].time_s)}`:displayedFrame?'已选画面':'画面暂不可用';notifyTimeline();}
function ambientActive(){return motionEnabled&&!document.hidden}
function updateMotion(){const enabled=motionEnabled;$('motion').textContent=enabled?'动态 开':'动态 关';$('motion').setAttribute('aria-pressed',String(enabled));$('motion').setAttribute('aria-label',enabled?'关闭氛围动态':'开启氛围动态');$('motionStatus').textContent=enabled?'动态已开启 · 星点缓缓漂移，展开与收回平滑过渡':reduced.matches&&!motionOverride?'已遵循系统「减少动态」设置；仍可点「动态 关」主动开启。':'动态已暂停 · 色彩与位置保持静止';}
function driftPosition(i){const n=nodes[i],phase=ambientTime*.65+i*2.1;return{x:n.x*1000+Math.sin(phase)*14,y:n.y*610+Math.cos(phase*.83)*10}}
function nodePosition(i){if(i===movieIndex&&(progress>0||transition))return{x:anchor.x*1000,y:anchor.y*610};const p=driftPosition(i),o=nodeOffsets[i],e=Math.exp(-(ambientTime-o.start)/2);return{x:p.x+o.x*e,y:p.y+o.y*e}}
// Camera maps the same world throughout: the ring remains centered on its film node.
function focusCamera(){const xs=nodes.map(n=>n.x*1000),ys=nodes.map(n=>n.y*610);return{x:clamp(500-anchor.x*1000*FOCUS_ZOOM,95-(Math.min(...xs)-14)*FOCUS_ZOOM,905-(Math.max(...xs)+14)*FOCUS_ZOOM),y:clamp(350-anchor.y*610*FOCUS_ZOOM,50-(Math.min(...ys)-10)*FOCUS_ZOOM,650-(Math.max(...ys)+10)*FOCUS_ZOOM)}}
function camera(p=progress){const t=smooth(p),z=lerp(1,FOCUS_ZOOM,t),to=focusCamera();return{z,x:to.x*t,y:to.y*t}}
function worldToScreen(p){const c=camera();return{x:p.x*c.z+c.x,y:p.y*c.z+c.y}}
function screenToWorld(p){const c=camera();return{x:(p.x-c.x)/c.z,y:(p.y-c.y)/c.z}}
function ringTransform(){const c=camera(),p=worldToScreen({x:anchor.x*1000,y:anchor.y*610});return{x:p.x,y:p.y,k:c.z/FOCUS_ZOOM}}
function ringToScreen(p){const t=ringTransform();return{x:t.x+(p.x-500)*t.k,y:t.y+(p.y-350)*t.k}}
function screenToRing(p){const t=ringTransform();return{x:500+(p.x-t.x)/t.k,y:350+(p.y-t.y)/t.k}}
function releaseNode(){const p=driftPosition(movieIndex);nodeOffsets[movieIndex]={x:anchor.x*1000-p.x,y:anchor.y*610-p.y,start:ambientTime}}


const listeners=[];
function listen(el,type,fn,options){el.addEventListener(type,fn,options);listeners.push(()=>el.removeEventListener(type,fn,options))}
function setup(el,w,h){const r=Math.min(window.devicePixelRatio||1,2);if(el.width!==w*r||el.height!==h*r){el.width=w*r;el.height=h*r}const c=el.getContext('2d');c.setTransform(r,0,0,r,0,0);c.clearRect(0,0,w,h);return c}
function poly(c,pts,color){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill()}
function line(c,pts,color,width=1){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width;c.stroke()}
function label(c,text,x,y,size=11,color='#96a3b7',align='left'){c.font=`${size}px Arial,"PingFang SC",sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y)}
// Every film uses the same open ring. Time and stripe identity never move.
function layout(){return{name:'环形时间色带',hint:'顺时针 · 时间固定'}}
function ribbon(t,r=248){const a=ORBIT_START+clamp(t,0,1)*ORBIT_SWEEP;return{x:500+r*Math.cos(a),y:350+r*Math.sin(a)}}
function morphShape(p=progress){const unfold=smooth(p);return{unfold,width:46*unfold,scale:Math.max(.0001,unfold)}}
function center(t){const m=morphShape(),q=ribbon(t);return{x:500+(q.x-500)*m.scale,y:350+(q.y-350)*m.scale}}
function edge(t){const m=morphShape(),p=center(t),a=ORBIT_START+clamp(t,0,1)*ORBIT_SWEEP,nx=Math.cos(a),ny=Math.sin(a),w=m.width;return{p,a:{x:p.x+nx*w,y:p.y+ny*w},b:{x:p.x-nx*w,y:p.y-ny*w},nx,ny,w}}
function tileGeometry(t,u){const outer=[],inner=[];for(let j=0;j<=4;j++){const e=edge(lerp(t,u,j/4));outer.push(e.a);inner.push(e.b)}const p=center((t+u)/2);return{pts:[...outer,...inner.reverse()],x:p.x,y:p.y}}
// Echo curves stop short of the ribbon. Time guides alone reach its exact timestamp.
function echoPaths(ref=reference,result=echoResult){if(!result)return[];const pt=(a,r)=>({x:500+Math.cos(a)*r,y:350+Math.sin(a)*r}),bez=(p,a,b,q,t)=>({x:(1-t)**3*p.x+3*(1-t)**2*t*a.x+3*(1-t)*t*t*b.x+t**3*q.x,y:(1-t)**3*p.y+3*(1-t)**2*t*a.y+3*(1-t)*t*t*b.y+t**3*q.y});return result.episodes.map((ep,k)=>{const a=ORBIT_START+S[ref].time_s/T*ORBIT_SWEEP,b=ORBIT_START+S[ep.id].time_s/T*ORBIT_SWEEP,delta=((b-a+Math.PI*3)%TAU)-Math.PI,sign=delta<0?-1:1,r=180+k*1.1,off=Math.min(.22,Math.abs(delta)/3),aa=a+sign*off,bb=a+delta-sign*off,p=pt(a,194),q=pt(b,194),pa=pt(aa,r),pb=pt(bb,r),ca=pt(a,190),cb=pt(b,190),ac={x:pa.x+Math.sin(aa)*sign*18,y:pa.y-Math.cos(aa)*sign*18},bc={x:pb.x-Math.sin(bb)*sign*18,y:pb.y+Math.cos(bb)*sign*18},points=[];for(let j=0;j<=32;j++)points.push(bez(p,ca,ac,pa,j/32));const steps=Math.max(1,Math.ceil(Math.abs(bb-aa)*r/1.5));for(let j=1;j<=steps;j++)points.push(pt(lerp(aa,bb,j/steps),r));for(let j=1;j<=32;j++)points.push(bez(pb,bc,cb,q,j/32));return{ep,p,q,points}})}
function drawEchoes(c,paths=echoPaths(),ref=reference,opacity=1){if(!echoesEnabled)return;c.save();for(const path of paths){const tint=rgb=>'rgb('+rgb.map(v=>Math.round(v*.65+255*.35)).join(',')+')',gradient=c.createLinearGradient(path.p.x,path.p.y,path.q.x,path.q.y);gradient.addColorStop(0,tint(S[ref].rgb));gradient.addColorStop(1,tint(S[path.ep.id].rgb));c.globalAlpha=.44*opacity;line(c,path.points,gradient,2.1);c.globalAlpha=.65*opacity;c.fillStyle=tint(S[path.ep.id].rgb);c.beginPath();c.arc(path.q.x,path.q.y,2.7,0,TAU);c.fill()}c.restore()}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
// Small underpasses keep the dashed time guides visually independent of every echo.
function satelliteGuideSegments(paths=echoPaths()){const grid=new Map(),cell=12;for(const path of paths)for(let j=1;j<path.points.length;j++){const a=path.points[j-1],b=path.points[j];for(let x=Math.floor((Math.min(a.x,b.x)-5)/cell);x<=Math.floor((Math.max(a.x,b.x)+5)/cell);x++)for(let y=Math.floor((Math.min(a.y,b.y)-5)/cell);y<=Math.floor((Math.max(a.y,b.y)+5)/cell);y++){const key=x+'/'+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push([a,b])}}const segments=[];for(const p of satellites){const start=p.r+p.size/2+4,end=202,at=r=>ribbon(S[p.id].time_s/T,r);for(let r=start;r<end;r+=6){const stop=Math.min(r+2.4,end);let clear=true;for(let v=r;v<=stop+.01;v+=.4){const q=at(Math.min(v,stop));if(satellites.some(other=>other!==p&&Math.hypot(q.x-other.x,q.y-other.y)<other.size/2+5)){clear=false;break}if(paths.some(path=>Math.hypot(q.x-path.q.x,q.y-path.q.y)<6)||(grid.get(Math.floor(q.x/cell)+'/'+Math.floor(q.y/cell))||[]).some(([a,b])=>segmentDistance(q,a,b)<4.5)){clear=false;break}}if(clear)segments.push({id:p.id,a:at(r),b:at(stop)})}segments.push({id:p.id,a:at(200.5),b:at(end)})}return segments}
let guideCacheKey='',guideCache=[];
function drawSatelliteLeaders(c,opacity=1,segments=null){if(!echoesEnabled)return;const key=movieIndex+'/'+reference;if(key!==guideCacheKey){guideCacheKey=key;guideCache=satelliteGuideSegments()}c.save();c.globalAlpha=opacity;for(const seg of segments||guideCache)line(c,[seg.a,seg.b],'#c9d2df38',.75);c.restore()}
function drawRingDetail(c,alpha){c.save();c.globalAlpha=alpha;for(let t=900;t<T;t+=900){const p=ribbon(t/T,326),a=ribbon(t/T,302),b=ribbon(t/T,308);line(c,[a,b],'#78818e99',1);label(c,fmt(t),p.x,p.y+4,12,'#78818ed1',p.x>510?'left':p.x<490?'right':'center')}const e=edge((positions[selected][0]+positions[selected][1])*.5);line(c,[e.a,e.b],'#c5ccd6a6',1);const mix=referenceMix();const marker=(ref,opacity)=>{const a=ORBIT_START+S[ref].time_s/T*ORBIT_SWEEP,p=ribbon(S[ref].time_s/T,300);c.save();c.globalAlpha=alpha*opacity;c.translate(p.x,p.y);c.rotate(a+Math.PI/2);poly(c,[{x:0,y:0},{x:-5,y:-11},{x:5,y:-11}],'#bca990c7');c.restore()};if(referenceTransition)for(const layer of referenceTransition.layers)marker(layer.reference,layer.weight*(1-mix));marker(reference,mix);if(alpha>.99){if(referenceTransition)for(const layer of referenceTransition.layers){drawEchoes(c,layer.paths,layer.reference,layer.weight*(1-mix));drawSatelliteLeaders(c,layer.weight*(1-mix),layer.guides)}drawEchoes(c,echoPaths(),reference,mix);drawSatelliteLeaders(c,mix)};c.restore()}
function advanceMorph(now,complete=true){if(!transition)return;const dt=Math.max(0,(now-transition.start)/1000),w=7,b=transition.velocity+w*(transition.from-target),e=Math.exp(-w*dt);progress=clamp(target+(transition.from-target+b*dt)*e,0,1);morphVelocity=(transition.velocity-w*b*dt)*e;if(Math.abs(progress-target)<.004&&Math.abs(morphVelocity)<.03){progress=target;morphVelocity=0;transition=null;if(!target){releaseNode();if(complete)finishClose()}}}
function updateMorphUI(){const ready=progress>=.995&&!transition;document.body.dataset.structure=target&&progress>.74?'ready':'forming';$('stage').setAttribute('aria-busy',String(!!transition));$('stage').style.cursor=transition?'progress':'pointer';for(const id of peripheralIds){const el=$(id);el.inert=!target||!ready;el.setAttribute('aria-hidden',String(!target||!ready))}if(transition)$('sceneHint').textContent=target?'色点正在舒展为色环… 展开后可选帧。':'色环正在收回光点…';else $('sceneHint').textContent=target?'悬浮预览 · 点击色环或小圆图固定参照 · 点击环外返回星图':'单片色彩节点。按回车键展开。'}
function renderStage(){const c=setup($('stage'),1000,730);
const life=1;
const breathing=1+Math.sin(ambientTime*.65)*.11*life;
c.globalAlpha=1;
// Small unlabelled dust specks, not a simulated movie collection.
for(const m of motes){const phase=ambientTime*m.speed+m.phase,x=m.x+Math.sin(phase)*18*life,y=m.y+Math.cos(phase*.7)*12*life;c.globalAlpha=(.18+.18*(.5+.5*Math.sin(phase)))*(1-progress*.35);c.fillStyle='#afbdd2';c.beginPath();const sp=worldToScreen({x,y});c.arc(sp.x,sp.y,m.r,0,TAU);c.fill()}
c.globalAlpha=1;
if(progress>0&&progress<.7){const gp=worldToScreen({x:anchor.x*1000,y:anchor.y*610}),glow=c.createRadialGradient(gp.x,gp.y,0,gp.x,gp.y,48*breathing);glow.addColorStop(0,'#b8d2f024');glow.addColorStop(.24,'#a8c9ee12');glow.addColorStop(1,'#94bcec00');c.globalAlpha=1-progress/.7;c.fillStyle=glow;c.fillRect(gp.x-55,gp.y-55,110,110);c.globalAlpha=1}
const key=[movieIndex,progress,selected,anchor.x,anchor.y,positionRevision].join('/');if(key!==geometryKey){geometryKey=key;hits=[];for(let i=0;i<N;i++){const [t,u]=positions[i];hits.push({i,...tileGeometry(t,u)})}}
const bandAlpha=smooth(progress/.16);
const rt=ringTransform();c.save();c.translate(rt.x,rt.y);c.scale(rt.k,rt.k);c.translate(-500,-350);
if(progress>0){
// Separate translucent black backplate: softness never touches the color tiles.
const diskRadius=304*smooth(progress),softness=9*smooth(progress);c.globalAlpha=smooth(progress);
const embeddedAtlas=document.documentElement?.dataset?.embeddedAtlas==='true';
const disk=c.createRadialGradient(500,350,embeddedAtlas?0:Math.max(0,diskRadius-softness),500,350,diskRadius+softness);
disk.addColorStop(0,'rgba(0,0,0,.58)');if(embeddedAtlas){disk.addColorStop(.2,'rgba(0,0,0,.56)');disk.addColorStop(.5,'rgba(0,0,0,.36)');disk.addColorStop(.8,'rgba(0,0,0,.13)');}else disk.addColorStop(.5,'rgba(0,0,0,.46)');disk.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=disk;c.beginPath();c.arc(500,350,diskRadius+softness,0,TAU);c.fill();c.globalAlpha=bandAlpha;for(const h of hits)poly(c,h.pts,S[h.i].hex);
c.globalAlpha=1}
const detailAlpha=smooth((progress-.88)/.12);if(detailAlpha>0)drawRingDetail(c,detailAlpha);c.restore();
$('satellitesPrevious').style.transformOrigin=$('satellites').style.transformOrigin='50% 47.945205%';$('satellitesPrevious').style.transform=$('satellites').style.transform=`translate(${(rt.x-500)/10}%,${(rt.y-350)/7.3}%) scale(${rt.k})`;
$('centralPreview').style.left=`${rt.x/10}%`;$('centralPreview').style.top=`${rt.y/7.3}%`;$('centralPreview').style.width=`${16*rt.k}%`;
$('centralPreview').style.opacity=String(detailAlpha);$('centralPreview').style.visibility=target&&progress>.88?'visible':'hidden';
drawGallery(c);updateMorphUI();syncSatellites();}
function nodeCaption(j,x,y){const rt=ringTransform(),r=294*smooth(progress)*rt.k,dx=Math.max(Math.abs(x-rt.x)-90,0),dy=clamp(rt.y,y+28,y+72)-rt.y,overlap=j!==movieIndex&&progress>0&&Math.hypot(dx,dy)<r+7;return overlap&&y>=46?{title:y-18,meta:y-36,above:true}:{title:y+43,meta:y+65,above:false}}
function drawGallery(c){
if(document.documentElement?.dataset?.embeddedAtlas==='true')return;
for(let j=0;j<films.length;j++){const f=films[j],{x,y}=worldToScreen(nodePosition(j)),active=j===galleryFocus,hover=j===galleryHover,color=f.samples[Math.floor(f.samples.length*.4)].hex;
const selectedNode=j===movieIndex,fade=selectedNode?1-smooth(progress/.2):1-.48*smooth(progress);c.globalAlpha=fade;
const glow=c.createRadialGradient(x,y,0,x,y,18+Math.sin(ambientTime*.9+j)*3);glow.addColorStop(0,color+'cc');glow.addColorStop(.35,color+'44');glow.addColorStop(1,color+'00');c.fillStyle=glow;c.fillRect(x-23,y-23,46,46);c.beginPath();c.arc(x,y,(active||hover?6:4.5)*(1+.16*Math.sin(Math.PI*clamp(progress/.2,0,1))),0,TAU);c.fillStyle=active||hover?'#e0e8f3':color;c.fill();
// Subtle real-film hues belong to the light point before it unfolds.
for(let k=0;k<5;k++){const a=k*TAU/5;c.beginPath();c.arc(x+Math.cos(a)*2.8,y+Math.sin(a)*2.8,1.7,0,TAU);c.fillStyle=f.samples[Math.floor((k+.5)/5*f.samples.length)].hex;c.fill()}
c.globalAlpha=selectedNode?1-smooth(progress/.3):1-.45*smooth(progress);const cap=nodeCaption(j,x,y);label(c,f.title,x,cap.title,14,active?'#e3eaf4':'#aebbcf','center');}
c.globalAlpha=1-smooth(progress/.35);label(c,(film.is_test_fixture?'合成数据 · 非真实长片':'电影色彩 · 时间采样'),48,548,10,'#69788e');label(c,'节点为编辑排布 · 无相似度含义',48,568,9,'#48566b');c.globalAlpha=1;
}
function nearestNode(p){p=screenToWorld(p);let best=-1,d=Infinity;nodes.forEach((n,i)=>{const actual=nodePosition(i),dx=Math.abs(p.x-actual.x),dy=p.y-actual.y;if(dx<100&&dy>-35&&dy<82){const distance=dx+Math.abs(dy);if(distance<d){d=distance;best=i}}});return best}
function activateMovie(i){clearDetailTransitions();displayedFrame=null;savedSelection[movieIndex]=selected;movieIndex=clamp(i,0,films.length-1);galleryFocus=movieIndex;film=films[movieIndex];S=film.samples;N=S.length;T=film.display_duration_s;B=S.map(s=>(.2126*s.rgb[0]+.7152*s.rgb[1]+.0722*s.rgb[2])/255);D=S.map((s,i)=>i?Math.hypot(...s.rgb.map((v,k)=>v-S[i-1].rgb[k])):0);DM=Math.max(1,...D);anchor={...nodes[movieIndex]};selected=clamp(savedSelection[movieIndex],0,N-1);focus=selected;geometryKey='';previewIndex=-1;frameRequest++;$('frame').removeAttribute('src');$('centralFrame').removeAttribute('src');resetSimilarity();updateFilmInfo();select(selected);updateScene()}
function openMovie(i){i=clamp(i,0,films.length-1);replayPending=false;if(i===movieIndex){pendingMovie=null;go(1);return}if(progress>0){pendingMovie=i;go(0)}else{pendingMovie=null;activateMovie(i);go(1)}}
function finishClose(){if(pendingMovie!==null){const i=pendingMovie;pendingMovie=null;activateMovie(i);go(1)}else if(replayPending){replayPending=false;go(1)}}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateFilmInfo(){
const label=film.is_test_fixture?'测试夹具 · 非真实长片':'影片色彩';
$('filmMeta').textContent=label+' · 00:00—'+fmtExtent(T)+' · '+N+' 个样本';
$('durationLabel').textContent='/ '+fmtExtent(T);document.querySelectorAll('.endtime').forEach(e=>e.textContent=fmtExtent(T));
const meta=film.metadata||{};
if($('metadataSource'))$('metadataSource').textContent='影片资料与译名来源说明见星图资料栏。';
if($('filmInfo')){$('filmInfo').textContent=[meta.title||film.title,meta.year?'年份：'+meta.year:'',Array.isArray(meta.genres)&&meta.genres.length?'类型：'+meta.genres.join(' / '):'',Array.isArray(meta.countries)&&meta.countries.length?'地区：'+meta.countries.join(' / '):'',Array.isArray(meta.directors)&&meta.directors.length?'导演：'+meta.directors.join(' / '):''].filter(Boolean).join('\n');}
if($('filmPoster')){const p=$('filmPoster');p.hidden=!film.poster;if(film.poster){p.src=film.poster;p.alt=(meta.title||film.title)+' 海报';p.onerror=()=>{p.hidden=true;};}}
$('filmNotes').textContent='仅展示本次处理窗口。原片起点 '+fmtExtent(film.source_start_s||0)+'；'+(film.source_duration_s?'来源探测时长 '+fmtExtent(film.source_duration_s)+'；':'')+'颜色为编码 RGB 算术均值；相近颜色不代表内容相似。截图按需读取。';
}

// Linked chronological miniatures, independent of ribbon rank order.
function chartMetrics(el){const w=Math.max(1,el.clientWidth||500);return{w,h:88,left:6,right:Math.max(7,w-6),top:22,base:76}}
function chartSampleAt(el,clientX){const r=el.getBoundingClientRect(),m=chartMetrics(el),px=(clientX-r.left)/Math.max(1,r.width)*m.w,t=clamp((px-m.left)/(m.right-m.left),0,1)*T;return Math.max(0,S.findLastIndex(s=>s.time_s<=t))}
function drawCharts(){
  const differenceMax=Math.max(25,Math.ceil(DM/25)*25);
  $('brightValue').textContent=B[selected].toFixed(3);
  $('changeValue').textContent=selected?D[selected].toFixed(1):'—';
  $('brightnessScale').textContent='0—1';
  $('differenceScale').textContent=`RGB · 0—${differenceMax}`;
  for(const [id,values,max,start] of [['brightness',B,1,0],['difference',D,differenceMax,1]]){
    const el=$(id),m=chartMetrics(el),{w,h,left,right,top,base}=m,c=setup(el,w,h);
    const at=i=>({x:left+S[i].time_s/T*(right-left),y:base-values[i]/max*(base-top)});
    // The initial sample has no predecessor: never plot its placeholder D[0].
    const pts=values.slice(start).map((_,j)=>at(j+start));
    if(pts.length){
      // Each last measurement covers its final sample interval, not a new sample.
      pts.push({x:right,y:pts[pts.length-1].y});
      let wash='#a3b8d214';
      const gradient=typeof c.createLinearGradient==='function'?c.createLinearGradient(0,top,0,base):null;
      if(gradient&&typeof gradient.addColorStop==='function'){gradient.addColorStop(0,'#a3b8d224');gradient.addColorStop(1,'#a3b8d201');wash=gradient}
      poly(c,[{x:pts[0].x,y:base},...pts,{x:right,y:base}],wash);
      line(c,pts,'#9bacbfaa',1.05);
    }
    line(c,[{x:left,y:base+.5},{x:right,y:base+.5}],'#c6d5ec22',.8);
    // Reference is a warm hollow diamond above the plot, distinct even at the current sample.
    const rx=at(reference).x;
    c.setLineDash([2,4]);line(c,[{x:rx,y:15},{x:rx,y:base+3}],'#cbb79755',.8);c.setLineDash([]);
    line(c,[{x:rx,y:5},{x:rx+3.5,y:8.5},{x:rx,y:12},{x:rx-3.5,y:8.5},{x:rx,y:5}],'#cbb797bb',1);
    const p=at(selected);
    line(c,[{x:p.x,y:18},{x:p.x,y:base+4}],'#d6e5fa55',.8);
    if(selected>=start){
      c.beginPath();c.arc(p.x,p.y,5,0,TAU);c.fillStyle='#dce8f718';c.fill();
      c.beginPath();c.arc(p.x,p.y,2.4,0,TAU);c.fillStyle='#e0eafb';c.fill();
    }
    const metric=id==='brightness'?`亮度代理 ${B[selected].toFixed(3)}，范围 0 到 1`:selected?`相邻采样平均 RGB 距离 ${D[selected].toFixed(1)}`:'首个采样，没有前序色差';
    el.title=`${fmt(S[selected].time_s)} · ${metric} · 参照 ${fmt(S[reference].time_s)}`;el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(S[N-1].time_s));el.setAttribute('aria-valuenow',String(S[selected].time_s));
    el.setAttribute('aria-valuetext',`${fmt(S[selected].time_s)}，${metric}。固定参照 ${fmt(S[reference].time_s)}。始终按时间顺序。`);
  }
}

// Keyboard and pointer navigation preserve the temporal axis.
function installChartNavigation(){
  for(const id of ['brightness','difference']){
    const el=$(id);let pointer=null;
    const choose=e=>{if(!target||transition)return;select(chartSampleAt(el,e.clientX))};
    listen(el,'pointermove',e=>{if(e.pointerType!=='touch'||pointer===e.pointerId)choose(e)});
    listen(el,'pointerdown',e=>{pointer=e.pointerId;if(e.pointerType==='mouse')el.focus({preventScroll:true});if(e.pointerType==='touch'||e.pointerType==='pen')el.setPointerCapture(e.pointerId);choose(e)});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(el,type,()=>{pointer=null});
    listen(el,'keydown',e=>{
      if(!target||transition)return;
      if(e.key==='Escape'){e.preventDefault();pendingMovie=null;replayPending=false;go(0);$('stage').focus();return}
      if(e.key==='Enter'||e.key===' '){e.preventDefault();pinReference();return}
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];
      if(!keys.includes(e.key))return;e.preventDefault();
      // Do not use neighbor(): ribbon order may be similarity, these plots are time.
      const step=e.key==='PageUp'?10:e.key==='PageDown'?-10:['ArrowRight','ArrowUp'].includes(e.key)?1:-1;
      select(e.key==='Home'?0:e.key==='End'?N-1:clamp(selected+step,0,N-1),true);
    });
  }
}


function queue(){if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(tick)}
function tick(now){raf=0;if(disposed||document.hidden)return;const dt=lastNow?Math.min(80,now-lastNow):16;lastNow=now;
if(ambientActive())ambientTime+=dt/1000;advanceSort(now);
advanceMorph(now);advanceDetails(now);
focus=!motionEnabled?selected:lerp(focus,selected,1-Math.exp(-dt/90));if(Math.abs(focus-selected)<.015)focus=selected;
if(transition||referenceTransition||frameTransition||focus!==selected||now-lastPaint>=32||!ambientActive()){renderStage();lastPaint=now}
if(transition||sortTransition||referenceTransition||frameTransition||focus!==selected||ambientActive())queue()}
function stageLabel(){return `${film.title}，${fmt(S[selected].time_s)}，样本 ${selected+1}/${N}。${target?'Enter 或空格固定参照，方向键选帧，Home/End 到首尾，Escape 返回。':`图库选中 ${films[galleryFocus].title}。方向键切换影片，Enter 或空格展开。`}`}
function updateScene(){document.body.dataset.scene=target?'film':'node';$('stage').setAttribute('aria-label',stageLabel());
for(const id of peripheralIds){const el=$(id);el.inert=!target;el.setAttribute('aria-hidden',String(!target));if(!target&&el.contains&&el.contains(document.activeElement))$('stage').focus()}
$('titleText').textContent=target?film.title:'影片';$('back').textContent=target?'缩回星图':'展开影片';$('sceneTitle').textContent=target?'星图中的环形时间色带':'电影的颜色，静候展开';$('sceneHint').textContent=target?'悬浮预览 · 点击色环或小圆图固定参照 · 点击环外返回星图':'单片色彩节点。按回车键展开。';$('direction').textContent=target?`00:00 → ${layout().hint} → ${fmtExtent(T)}`:'编辑排布 · 保留节点位置';$('stage').setAttribute('role',target?'slider':'button');if(target){$('stage').removeAttribute('aria-expanded');$('stage').setAttribute('aria-valuemin','0');$('stage').setAttribute('aria-valuemax',String(N-1));$('stage').setAttribute('aria-valuenow',String(selected));$('stage').setAttribute('aria-valuetext',`${fmt(S[selected].time_s)}，平均色 ${S[selected].hex}`)}else{['aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext'].forEach(a=>$('stage').removeAttribute(a));$('stage').setAttribute('aria-expanded','false')}$('stage').style.touchAction=target?'none':'pan-y';updateSortLabels()}
function go(value){advanceMorph(performance.now(),false);if(value&&progress===0){const p=nodePosition(movieIndex);anchor={x:p.x/1000,y:p.y/610}}const next=value?1:0;if(target===next&&transition)return;target=next;if(!next){frameRequest++;previewIndex=-1;clearDetailTransitions();$('centralPreview').dataset.loading='false'}else if(previewIndex!==reference){selected=reference;previewIndex=reference;preview(S[reference])}touchId=null;pressPoint=null;satellitePointer=null;satelliteClick=null;syncSatellites();updateScene();if(!motionEnabled){transition=null;progress=target;morphVelocity=0;focus=selected;if(target===0){releaseNode();finishClose()}queue();return}transition={from:progress,velocity:morphVelocity,start:performance.now()};queue()}

let frameRequest=0,previewIndex=-1;
function hdFrame(s){const entry=window.HD_FRAME_MANIFEST?.films?.[film.id]?.samples?.[String(s.index)];return entry&&entry.time_s===s.time_s&&entry.width>=480?entry.src:s.image}
function preview(s){
  const request=++frameRequest,title=film.title;let candidate=hdFrame(s),fallback=false;
  $('frame').dataset.loading='true';$('centralPreview').dataset.loading='true';
  function load(src){const img=new Image();img.crossOrigin="anonymous";img.onload=()=>{if(request!==frameRequest||disposed)return;const prior=displayedFrame,priorTree=frameTransition?.tree,mix=frameTransition?smooth((performance.now()-frameTransition.start)/FRAME_DURATION):1;
  const layers=frameTransition?frameTransition.layers.map(layer=>({...layer,weight:layer.weight*(1-mix)})):[];
  const tree=prior?snapshotBlend(priorTree,`<img crossorigin="anonymous" src="${safe(prior.src)}" alt="">`,mix):null;if(prior)layers.push({...prior,weight:mix});finishFrameTransition();
  for(const id of ['centralFrame']){$(id).src=src;$(id).alt=`${safe(title)} ${fmt(s.time_s)} 的真实采样画面`;}
  displayedFrame={src,time:s.time_s,index:s.index};
  if(prior&&prior.src!==src&&motionEnabled&&target&&progress>=.995){const visible=layers.filter(layer=>layer.weight>.001);$('centralFramePrevious').innerHTML=snapshotHTML(tree);$('centralFramePrevious').style.opacity='1';$('centralFrame').style.opacity='0';frameTransition={start:performance.now(),tree,layers:visible};queue()} $('frame').dataset.loading='false';$('centralPreview').dataset.loading='false';$('centralPreview').dataset.resolution=src===s.image?'thumbnail':'source';updateCentral();};
  img.onerror=()=>{if(request!==frameRequest||disposed)return;if(!fallback&&src!==s.image){fallback=true;load(s.image);return}$('frame').dataset.loading='false';$('centralPreview').dataset.loading='false';$('frame').removeAttribute('src');$('centralFrame').removeAttribute('src');$('centralFrame').alt='该采样画面暂时无法加载';displayedFrame=null;finishFrameTransition();updateCentral()};img.src=src;}
  load(candidate);
}
function select(i,announce=false){i=clamp(Math.round(Number(i)||0),0,N-1);const changed=i!==selected;selected=i;const s=S[i];$('time').textContent=fmt(s.time_s);$('hex').textContent=s.hex.toUpperCase();$('swatch').style.background=s.hex;$('sampleMeta').textContent=`${i+1} / ${N} · RGB ${s.rgb.join(' / ')}`;$('brightValue').textContent=`${(B[i]*100).toFixed(1)}%`;$('changeValue').textContent=i?D[i].toFixed(1):'— 首帧';if(target){$('stage').setAttribute('aria-valuenow',String(i));$('stage').setAttribute('aria-valuetext',`${fmt(s.time_s)}，平均色 ${s.hex}`)}$('stage').setAttribute('aria-label',stageLabel());updatePreviewRank();updateCentral();if(announce)$('announce').textContent=`${fmt(s.time_s)}，平均色 ${s.hex}`;drawCharts();queue()}
function inside(x,y,pts){let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes}
function point(e){const r=$('stage').getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*1000,y:(e.clientY-r.top)/r.height*730}}
function pick(e){if(transition||sortTransition||progress!==1)return false;const p=screenToRing(point(e));let best=null,dist=Infinity;for(const h of hits){if(inside(p.x,p.y,h.pts)){const d=Math.hypot(h.x-p.x,h.y-p.y);if(d<dist){dist=d;best=h}}}if(best){select(best.i);return true}return false}
listen($('stage'),'pointermove',e=>{if(!target&&!transition){galleryHover=nearestNode(point(e));if(galleryHover>=0)galleryFocus=galleryHover;$('stage').setAttribute('aria-label',stageLabel());queue();return}if((e.pointerType==='touch'||e.pointerType==='pen')&&touchId!==e.pointerId)return;pick(e)});
function outsideActiveRing(p){const q=screenToRing(p);return Math.hypot(q.x-500,q.y-350)>294*smooth(progress)}
listen($('stage'),'pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;if(pressPoint!==null){pressPoint.cancelled=true;return}pressPoint={x:e.clientX,y:e.clientY,pointerId:e.pointerId,wasOpen:!!target||progress>0,outside:outsideActiveRing(point(e)),cancelled:false};$('stage').setPointerCapture(e.pointerId);if(e.pointerType==='touch'||e.pointerType==='pen'){touchId=e.pointerId;if(target)pick(e)}});
listen($('stage'),'pointermove',e=>{if(pressPoint?.pointerId===e.pointerId&&Math.hypot(e.clientX-pressPoint.x,e.clientY-pressPoint.y)>=8)pressPoint.cancelled=true});
listen($('stage'),'pointerup',e=>{const p=pressPoint;if(!p||p.pointerId!==e.pointerId)return;pressPoint=null;touchId=null;if(p.cancelled||Math.hypot(e.clientX-p.x,e.clientY-p.y)>=8)return;const screen=point(e);if(screen.x<0||screen.x>1000||screen.y<0||screen.y>730)return;if(p.wasOpen){if(p.outside&&outsideActiveRing(point(e))){pendingMovie=null;replayPending=false;go(0)}else if(target&&pick(e))pinReference();return}if(!target&&!transition){const i=nearestNode(point(e));if(i>=0)openMovie(i)}});
for(const type of ['pointercancel','lostpointercapture'])listen($('stage'),type,e=>{if(pressPoint?.pointerId===e.pointerId)pressPoint=null;if(touchId===e.pointerId)touchId=null});
listen($('stage'),'keydown',e=>{if(e.key==='Escape'){e.preventDefault();pendingMovie=null;replayPending=false;go(0);return}if(e.key==='Enter'||e.key===' '){e.preventDefault();pendingMovie=null;replayPending=false;if(target){if(!transition)pinReference()}else openMovie(galleryFocus);return}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();if(!target){galleryFocus=e.key==='Home'?0:e.key==='End'?films.length-1:(galleryFocus+(['ArrowRight','ArrowDown'].includes(e.key)?1:films.length-1))%films.length;$('stage').setAttribute('aria-label',stageLabel());$('announce').textContent=films[galleryFocus].title;queue();return}replayPending=false;select(e.key==='Home'?order[0]:e.key==='End'?order[N-1]:neighbor(['ArrowRight','ArrowUp'].includes(e.key)?1:-1),true)}});

installChartNavigation();
listen($('back'),'click',()=>{pendingMovie=null;replayPending=false;if(target)go(0);else openMovie(galleryFocus)});listen($('replay'),'click',()=>{pendingMovie=null;replayPending=progress>0;if(replayPending)go(0);else go(1)});
for(const [id,step] of [['prev',-1],['next',1]])listen($(id),'click',()=>{replayPending=false;if(!target)go(1);select(neighbor(step),true)});
listen(document,'pointermove',()=>{lastInteraction=performance.now()},{passive:true});
listen(document,'keydown',e=>{lastInteraction=performance.now();if(e.key==='Escape'&&!e.defaultPrevented&&(target||progress>0)){e.preventDefault();pendingMovie=null;replayPending=false;go(0);$('stage').focus({preventScroll:true})}});
listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;lastNow=0}else{if(transition)transition={from:progress,velocity:morphVelocity,start:performance.now()};queue()}});
listen($('motion'),'click',()=>{motionOverride=true;motionEnabled=!motionEnabled;if(!motionEnabled){if(sortTransition){positions=sortTransition.to;sortTransition=null;positionRevision++;updateSortLabels()}if(transition){progress=target;morphVelocity=0;transition=null;if(!target){releaseNode();finishClose()}}}updateMotion();queue()});
listen(window,'resize',()=>{queue();drawCharts()});listen(reduced,'change',()=>{if(!motionOverride)motionEnabled=!reduced.matches;if(!motionEnabled){if(sortTransition){positions=sortTransition.to;sortTransition=null;positionRevision++;updateSortLabels()}if(transition){progress=target;morphVelocity=0;transition=null;if(!target){releaseNode();finishClose()}}focus=selected}updateMotion();queue()});
listen($('pin'),'click',()=>pinReference());listen($('similar'),'click',()=>{echoesEnabled=!echoesEnabled;updateSortLabels();syncSatellites();queue()});listen($('circleToggle'),'click',()=>{circleCrop=!circleCrop;updateCentral();queue()});
for(const id of ['matches','satellites']){
  listen($(id),'click',e=>{const b=e.target.closest('[data-sample]');if(!b||!target||transition)return;const sample=Number(b.dataset.sample);if(id==='satellites'&&e.detail>0){const allowed=satelliteClick;satelliteClick=null;if(!allowed||allowed.sample!==sample||(e.pointerId!==undefined&&allowed.pointerId!==e.pointerId))return}$('stage').focus({preventScroll:true});select(sample,true);pinReference(sample)});
  listen($(id),'pointerover',e=>{if(e.pointerType==='touch'||e.pointerType==='pen'||!target||transition)return;const b=e.target.closest('[data-sample]');if(b)select(Number(b.dataset.sample))});
  listen($(id),'focusin',e=>{if(!target||transition)return;const b=e.target.closest('[data-sample]');if(b)select(Number(b.dataset.sample))});
  listen($(id),'keydown',e=>{if(e.key==='Escape'){e.preventDefault();pendingMovie=null;replayPending=false;go(0);$('stage').focus()}});
}
listen($('satellites'),'pointerdown',e=>{const b=e.target.closest('[data-sample]');if(!b||!target||transition)return;if(satellitePointer!==null){e.preventDefault();return}satelliteClick=null;satellitePointer={pointerId:e.pointerId,sample:Number(b.dataset.sample),x:e.clientX,y:e.clientY}});
listen(document,'pointerup',e=>{const p=satellitePointer;if(!p||p.pointerId!==e.pointerId)return;satellitePointer=null;const b=e.target.closest?.('#satellites [data-sample]');satelliteClick=b&&Number(b.dataset.sample)===p.sample&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<8?p:null});
for(const type of ['pointercancel','lostpointercapture'])listen(document,type,e=>{if(satellitePointer?.pointerId===e.pointerId){satellitePointer=null;satelliteClick=null}});
listen($('satellites'),'error',e=>{if(e.target.tagName!=='IMG')return;const b=e.target.closest('[data-sample]'),sample=b&&S[Number(b.dataset.sample)];if(sample&&!e.target.dataset.fallback){e.target.dataset.fallback='true';e.target.src=sample.image}else e.target.style.visibility='hidden'},true);
let pressPoint=null;
// Public integration API. Gallery positions remain fixed across every transition.
window.FilmGallery={subscribeTimeline(listener){timelineListeners.add(listener);return()=>timelineListeners.delete(listener)},getChartData(){return{duration:T,samples:S.map((s,i)=>({time_s:s.time_s,end_s:s.end_s,hex:s.hex,brightness:B[i],difference:i?D[i]:null}))}},selectSample(i,{pin=false}={}){if(!target||transition)return;select(i,true);if(pin)pinReference(i)},open(id){const i=typeof id==='number'?id:films.findIndex(f=>f.id===id);if(i>=0&&i<films.length)openMovie(i)},close(){pendingMovie=null;replayPending=false;go(0)},getState(){return{film:film.id,displayed_time_s:displayedFrame?displayedFrame.time:null,displayed_sample:displayedFrame?displayedFrame.index:null,frame_loading:$('centralPreview').dataset.loading==='true',galleryFocus,selected,time_s:S[selected].time_s,progress,target,anchor:{...anchor},camera:camera(),pendingMovie,reference,sortMode,order:[...order],distances:[...distances],sorting:!!sortTransition,echoes:echoResult.episodes.map(ep=>({...ep})),echoesEnabled,circleCrop,motionEnabled,ambientTime}},destroy(){timelineListeners.clear();disposed=true;frameRequest++;clearDetailTransitions();cancelAnimationFrame(raf);raf=0;transition=null;sortTransition=null;listeners.splice(0).forEach(remove=>remove())}};
resetSimilarity();updateFilmInfo();select(selected);updateScene();updateMotion();queue();

