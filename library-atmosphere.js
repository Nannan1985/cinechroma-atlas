/* Decorative depth and sparse, metadata-backed constellations. No hit targets. */
(function(root){
'use strict';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function tree(members,positions){
 if(members.length<2)return [];
 const reached=new Set([members[0]]),out=[],distance=new Map(),parent=new Map();
 for(const i of members.slice(1)){distance.set(i,Infinity);parent.set(i,members[0]);}
 let last=members[0];
 while(reached.size<members.length){
  let next=-1,best=Infinity;
  for(const i of members){if(reached.has(i))continue;const a=positions[last],b=positions[i],d=(a.x-b.x)**2+(a.y-b.y)**2;if(d<distance.get(i)){distance.set(i,d);parent.set(i,last);}if(distance.get(i)<best){best=distance.get(i);next=i;}}
  if(next<0)break;out.push({a:parent.get(next),b:next,d:Math.sqrt(best)});reached.add(next);last=next;
 }
 return out;
}
function constellations(films,positions,seriesKey){
 const groups=new Map();films.forEach((f,i)=>{const key=seriesKey(f);if(!key||!positions[i])return;if(!groups.has(key))groups.set(key,{key,name:f.series||'同系列',members:[]});groups.get(key).members.push(i);});
 return [...groups.values()].filter(g=>g.members.length>1).map(g=>({...g,edges:tree(g.members,positions)})).sort((a,b)=>Math.max(...a.edges.map(e=>e.d))-Math.max(...b.edges.map(e=>e.d))||a.key.localeCompare(b.key));
}
// Soft exposure fields suggest projected color and film halation, not extra data stars.
// Store vector parameters only: no small raster texture, tiled grain or repeated dots.
function makeBackground(doc,positions,hash){
 return {lights:[
  {x:.16,y:.58,rx:.38,ry:.18,angle:-.16,rgb:'156,119,80',alpha:.09},
  {x:.42,y:.45,rx:.46,ry:.22,angle:-.12,rgb:'76,115,139',alpha:.10},
  {x:.72,y:.35,rx:.34,ry:.18,angle:.13,rgb:'118,94,137',alpha:.075},
  {x:.66,y:.68,rx:.29,ry:.16,angle:-.25,rgb:'91,124,127',alpha:.055}
 ]};
}
function drawBackground(c,bg,w,h,pan,zoom,focus,expansion){
 const t=smooth(expansion),shift=focus||{x:0,y:0};
 c.save();c.globalAlpha=1;const base=c.createLinearGradient(0,0,w,h);base.addColorStop(0,'#090d15');base.addColorStop(.5,'#0b1019');base.addColorStop(1,'#080b12');c.fillStyle=base;c.fillRect(0,0,w,h);
 const dx=(pan.x*(1-t)-shift.x*t)*.09,dy=(pan.y*(1-t)-shift.y*t)*.09,z=1+(zoom-1)*.06+t*.035;
 // Render gradients at the canvas resolution instead of magnifying an 8-bit fog map.
 c.globalAlpha=1-.72*t;
 for(const light of bg.lights||[]){
  c.save();c.translate(light.x*w+dx,light.y*h+dy);c.rotate(light.angle);
  c.scale(light.rx*w*z,light.ry*h*z);
  const g=c.createRadialGradient(0,0,0,0,0,1);
  g.addColorStop(0,'rgba('+light.rgb+','+light.alpha+')');
  g.addColorStop(.35,'rgba('+light.rgb+','+light.alpha*.55+')');
  g.addColorStop(1,'rgba('+light.rgb+',0)');
  c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
 }
 const vignette=c.createRadialGradient(w*.48,h*.48,Math.min(w,h)*.25,w*.48,h*.48,Math.max(w,h)*.63);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.3)');c.globalAlpha=1;c.fillStyle=vignette;c.fillRect(0,0,w,h);
 // Blend the decorative sky into the page, without fading selectable stars.
 const rim=c.createLinearGradient(0,0,0,h);rim.addColorStop(0,'#090b10');rim.addColorStop(.17,'#090b1000');rim.addColorStop(.8,'#090b1000');rim.addColorStop(1,'#090b10');c.fillStyle=rim;c.fillRect(0,0,w,h);
 const sides=c.createLinearGradient(0,0,w,0);sides.addColorStop(0,'#090b10');sides.addColorStop(.12,'#090b1000');sides.addColorStop(.88,'#090b1000');sides.addColorStop(1,'#090b10');c.fillStyle=sides;c.fillRect(0,0,w,h);c.restore();
}
function drawEdges(c,edges,project,visible,w,h,alpha,color,maxLength=Infinity,budget=Infinity){
 c.save();c.strokeStyle=color;c.lineWidth=.9;c.globalAlpha=alpha;c.setLineDash([]);let count=0;
 for(const e of edges){if(count>=budget)break;if(!visible.has(e.a)||!visible.has(e.b))continue;const a=project(e.a),b=project(e.b),length=Math.hypot(a.x-b.x,a.y-b.y);if(length>maxLength||length<4||(a.x<0&&b.x<0)||(a.x>w&&b.x>w)||(a.y<0&&b.y<0)||(a.y>h&&b.y>h))continue;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();count++;}c.restore();return count;
}
const api={smooth,tree,constellations,makeBackground,drawBackground,drawEdges};if(typeof module!=='undefined')module.exports=api;else root.LibraryAtmosphere=api;
})(globalThis);
