/* Side-panel curves reuse the gallery's metric data and selection state. */
(function(root){
'use strict';
const T=s=>root.LibraryI18n?root.LibraryI18n.t(s):s;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function format(t){t=Math.max(0,Math.floor(t));const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function sampleAt(samples,duration,fraction){const time=clamp(fraction,0,1)*duration;let lo=0,hi=samples.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(samples[mid].time_s<=time)lo=mid;else hi=mid-1;}return lo;}
function create(container,timeline=null){
 const $=id=>container.querySelector('#'+id),canvases=[$('atlasBrightness'),$('atlasDifference')],strip=timeline?.querySelector('#atlasColorStrip'),at=id=>timeline?.querySelector('#'+id);
 const controls=strip?[strip,...canvases]:canvases;
 let gallery=null,data=null,state=null,last='',raf=0,unsubscribe=null,diffMax=25;
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw();});};
 function detach(){unsubscribe?.();unsubscribe=null;if(raf)cancelAnimationFrame(raf);raf=0;}
 function setEmpty(message){detach();gallery=data=state=null;last='';container.dataset.state='empty';$('chartStatus').textContent=message;$('chartTime').textContent='';if(timeline){timeline.dataset.state='empty';at('timelineStatus').textContent=T('全片色彩暂不可用');at('timelineStatus').title=message;strip.setAttribute('aria-disabled','true');strip.tabIndex=-1;strip.title='';strip.width=strip.width;for(const attr of ['aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext'])strip.removeAttribute(attr);at('timelineCursor').textContent='';at('timelineFrame').textContent='';}}
 function setGallery(next){detach();gallery=next;data=next.getChartData();if(!data.samples.length){setEmpty(T('全片色彩暂不可用'));return;}diffMax=Math.max(25,Math.ceil(Math.max(1,...data.samples.map(s=>s.difference||0))/25)*25);container.dataset.state='ready';$('chartStatus').textContent='';container.querySelectorAll('.chart-end').forEach(e=>e.textContent=format(data.duration));if(timeline){timeline.dataset.state='ready';strip.setAttribute('aria-disabled','false');strip.tabIndex=0;}last='';unsubscribe=next.subscribeTimeline?.(update);update(next.getState());}
 function update(next){if(!data)return;state=next;const key=[next.selected,next.reference,next.displayed_time_s,next.frame_loading].join('/');if(key!==last){last=key;labels();schedule();}}
 function labels(){
  if(!data||!state)return;const samples=data.samples,i=clamp(state.selected,0,samples.length-1),ref=clamp(state.reference,0,samples.length-1);
  $('chartTime').textContent=format(samples[i].time_s);$('atlasBrightValue').textContent=samples[i].brightness.toFixed(3);$('atlasDiffValue').textContent=i?samples[i].difference.toFixed(1):'—';$('atlasDiffScale').textContent='0—'+diffMax;
  if(timeline){at('timelineCursor').textContent=T('定位 ')+format(samples[i].time_s);const frame=at('timelineFrame');frame.dataset.loading=String(!!state.frame_loading);frame.textContent=state.frame_loading?T('加载 ')+format(samples[ref].time_s):state.displayed_time_s!=null?T('画面 ')+format(state.displayed_time_s):T('画面不可用');frame.title=state.displayed_time_s!=null?T('画面 ')+format(state.displayed_time_s):T('画面不可用');strip.title=format(samples[i].time_s)+' / '+format(data.duration)+' · '+T('悬浮或方向键定位；单击或回车更新画面。');}
  controls.forEach(el=>{const k=canvases.indexOf(el),metric=k<0?samples[i].hex:k?(i?T('相邻色彩变化 ')+samples[i].difference.toFixed(1):T('首帧无前序色差')):T('明暗变化 ')+samples[i].brightness.toFixed(3);if(k>=0)el.title=format(samples[i].time_s)+' · '+metric+T(' · 点击固定画面');el.setAttribute('aria-valuemin','0');el.setAttribute('aria-valuemax',String(samples.at(-1).time_s));el.setAttribute('aria-valuenow',String(samples[i].time_s));el.setAttribute('aria-valuetext',format(samples[i].time_s)+' · '+metric);});
 }
 function drawStrip(samples,i,ref){
  if(!strip)return;const w=Math.max(1,strip.clientWidth),h=Math.max(1,strip.clientHeight),dpr=Math.min(devicePixelRatio||1,2);strip.width=Math.round(w*dpr);strip.height=Math.round(h*dpr);const c=strip.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);const x=t=>5+t/data.duration*Math.max(1,w-10),top=6,bottom=h-6;
  for(const s of samples){c.fillStyle=s.hex;c.fillRect(x(s.time_s),top,Math.max(.1,x(s.end_s)-x(s.time_s)),bottom-top);}
  c.strokeStyle='#b3c6d326';c.lineWidth=1;c.strokeRect(4.5,top-.5,Math.max(1,w-9),bottom-top+1);
  c.fillStyle='#c4b58e';c.beginPath();c.moveTo(x(samples[ref].time_s),top);c.lineTo(x(samples[ref].time_s)-3,1);c.lineTo(x(samples[ref].time_s)+3,1);c.closePath();c.fill();
  c.strokeStyle='#eef3f7';c.lineWidth=1;c.beginPath();c.moveTo(x(samples[i].time_s),top);c.lineTo(x(samples[i].time_s),h-1);c.stroke();
 }
 function draw(){
  if(!data||!state)return;const samples=data.samples,i=clamp(state.selected,0,samples.length-1),ref=clamp(state.reference,0,samples.length-1);labels();drawStrip(samples,i,ref);

  canvases.forEach((el,k)=>{
   const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight),dpr=Math.min(devicePixelRatio||1,2);el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);const c=el.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
   const left=5,right=w-5,top=10,bottom=h-5,key=k?'difference':'brightness',max=k?diffMax:1,start=k?1:0,x=j=>left+samples[j].time_s/data.duration*(right-left),y=j=>bottom-samples[j][key]/max*(bottom-top);
   c.strokeStyle='#a9bdd514';c.lineWidth=1;for(const f of [0,.5,1]){const yy=bottom-f*(bottom-top);c.beginPath();c.moveTo(left,yy);c.lineTo(right,yy);c.stroke();}
   if(samples.length>start){c.beginPath();c.moveTo(x(start),y(start));for(let j=start+1;j<samples.length;j++)c.lineTo(x(j),y(j));c.lineTo(right,y(samples.length-1));c.strokeStyle=k?'#b3a4c8':'#9dbdcd';c.lineWidth=1.1;c.stroke();c.lineTo(right,bottom);c.lineTo(x(start),bottom);c.closePath();c.fillStyle=k?'#b3a4c810':'#9dbdcd10';c.fill();}
   c.strokeStyle='#c4b58e70';c.setLineDash([2,4]);c.beginPath();c.moveTo(x(ref),3);c.lineTo(x(ref),bottom);c.stroke();c.setLineDash([]);c.strokeStyle='#cbd8e580';c.beginPath();c.moveTo(x(i),top);c.lineTo(x(i),bottom);c.stroke();
   if(i>=start){c.fillStyle='#dce6ef';c.beginPath();c.arc(x(i),y(i),2.2,0,Math.PI*2);c.fill();}

  });
 }
 function choose(el,event,pin){if(!gallery||!data)return;const r=el.getBoundingClientRect(),i=sampleAt(data.samples,data.duration,(event.clientX-r.left-5)/Math.max(1,r.width-10));gallery.selectSample(i,{pin});update(gallery.getState());}
 controls.forEach(el=>{
  el.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')choose(el,e,false);});
  el.addEventListener('click',e=>{choose(el,e,true);el.focus({preventScroll:true});});
  el.addEventListener('keydown',e=>{if(!gallery||!data||!state)return;let next=state.selected,pin=false;if(e.key==='Home')next=0;else if(e.key==='End')next=data.samples.length-1;else if(e.key==='ArrowRight'||e.key==='ArrowUp')next++;else if(e.key==='ArrowLeft'||e.key==='ArrowDown')next--;else if(e.key==='Enter'||e.key===' ')pin=true;else return;e.preventDefault();gallery.selectSample(clamp(next,0,data.samples.length-1),{pin});update(gallery.getState());});
 });
 const observer=new ResizeObserver(schedule);observer.observe(container);if(timeline)observer.observe(timeline);
 return{setEmpty,setGallery,update,refresh:draw};
}
const api={create,format,sampleAt};if(typeof module!=='undefined')module.exports=api;else root.LibraryCharts=api;
})(globalThis);
