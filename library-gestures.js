/* Camera and pointer math shared by the browser and focused Node tests. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function fit(points,width,height,insets={}){
 const left=insets.left??24,right=insets.right??24,top=insets.top??64,bottom=insets.bottom??56;
 const ps=points.length?points:[{x:100,y:100},{x:1900,y:1200}],xs=ps.map(p=>p.x),ys=ps.map(p=>p.y);
 const minX=Math.min(...xs)-12,maxX=Math.max(...xs)+12,minY=Math.min(...ys)-12,maxY=Math.max(...ys)+12;
 const w=Math.max(1,width-left-right),h=Math.max(1,height-top-bottom);
 return{scale:Math.min(w/Math.max(1,maxX-minX),h/Math.max(1,maxY-minY)),center:{x:(minX+maxX)/2,y:(minY+maxY)/2},origin:{x:left+w/2,y:top+h/2}};
}
function worldAt(camera,p){return{x:camera.center.x+(p.x-camera.origin.x-camera.pan.x)/(camera.scale*camera.zoom),y:camera.center.y+(p.y-camera.origin.y-camera.pan.y)/(camera.scale*camera.zoom)};}
function anchor(camera,world,p,zoom){zoom=clamp(zoom,.45,5);return{zoom,pan:{x:p.x-camera.origin.x-(world.x-camera.center.x)*camera.scale*zoom,y:p.y-camera.origin.y-(world.y-camera.center.y)*camera.scale*zoom}};}
function zoomAt(camera,value,p=camera.origin){return anchor(camera,worldAt(camera,p),p,value);}
function starMetrics(width,zoom,degree=1,ready=true,emphasized=false,height=Infinity){
 // CSS pixels, independent of world fit and device pixel ratio. Association ranks remain stable.
 const effectiveWidth=Math.min(width,height*1.6),phone=effectiveWidth<=740,base=phone?clamp(effectiveWidth/280,1.25,1.65):clamp(effectiveWidth/580,2.15,3),growth=clamp(Math.pow(Math.max(.01,zoom),.42),.78,1.97);
 const radius=clamp(base*clamp(degree,.8,1.3)*growth*(ready?1:.72),phone?.9:1.4,phone?4.3:6.8);
 return{radius,halo:radius+(phone?3.2:6)+(emphasized?2:0),alpha:emphasized?.18:ready?.095:.065};
}
function hitCandidates(items,p,touch=false){
 const hits=items.map(item=>({...item,distance:Math.hypot(item.x-p.x,item.y-p.y)})).filter(item=>item.distance<=Math.max(item.radius+3,touch?18:9));
 // Exact visible disks win only when unambiguous; enlarged touch targets never favor a larger star.
 const disks=hits.filter(item=>item.distance<=item.radius+1.5),pool=disks.length===1?disks:hits;
 return pool.sort((a,b)=>a.distance-b.distance||String(a.id).localeCompare(String(b.id)));
}
function createController(getCamera,setCamera){
 const pointers=new Map();let session=null,baseline=null;
 const centroid=pair=>({x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2});
 function rebase(){const ps=[...pointers.values()],camera=getCamera();if(ps.length>=2){const mid=centroid(ps);baseline={kind:'pinch',ids:[...pointers.keys()].slice(0,2),world:worldAt(camera,mid),distance:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)),zoom:camera.zoom};}else if(ps.length)baseline={kind:'pan',start:{...ps[0]},pan:{...camera.pan}};else baseline=null;}
 function down(id,p){if(!pointers.size)session={moved:false,multi:false};pointers.set(id,{...p});if(pointers.size>1)session.multi=true;rebase();}
 function move(id,p){if(!pointers.has(id)||!session)return false;pointers.set(id,{...p});if(baseline?.kind==='pinch'){
  const pair=baseline.ids.map(i=>pointers.get(i));if(pair.some(q=>!q)){rebase();return true;}
  const mid=centroid(pair),distance=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);session.moved=true;
  setCamera(anchor(getCamera(),baseline.world,mid,baseline.zoom*distance/baseline.distance));
 }else if(baseline){const dx=p.x-baseline.start.x,dy=p.y-baseline.start.y;if(Math.hypot(dx,dy)>5)session.moved=true;if(session.moved||session.multi)setCamera({zoom:getCamera().zoom,pan:{x:baseline.pan.x+dx,y:baseline.pan.y+dy}});}return true;}
 function end(id,p){if(!pointers.has(id))return{tap:false};move(id,p);const tap=pointers.size===1&&!session.moved&&!session.multi;pointers.delete(id);if(pointers.size)rebase();else{baseline=null;session=null;}return{tap};}
 function cancel(){pointers.clear();session=null;baseline=null;}
 return{down,move,end,cancel,has:id=>pointers.has(id),ids:()=>[...pointers.keys()],active:()=>pointers.size>0};
}
const api={fit,worldAt,anchor,zoomAt,starMetrics,hitCandidates,createController};if(typeof module!=='undefined')module.exports=api;else root.LibraryGestures=api;
})(globalThis);
