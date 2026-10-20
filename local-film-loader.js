'use strict';
(async()=>{const status=document.getElementById('localStatus');const fail=()=>{status.textContent=document.documentElement.lang==='en'?'This film could not be loaded.':'影片暂不可用，请返回星图重试。';};try{
 const id=new URLSearchParams(location.search).get('id');if(!/^local-[a-z0-9][a-z0-9-]{0,79}$/.test(id||''))throw Error('Invalid film ID');
 const r=await fetch(AtlasDeployment.asset('releases/'+ATLAS_CONFIG.release+'/films/'+id+'.json'),{credentials:'omit'});if(!r.ok)throw Error('Unknown film');const f=await r.json();
 if(f.id!==id||!Array.isArray(f.samples)||!f.samples.length||!Number.isFinite(f.duration_s)||f.duration_s<=0)throw Error('Invalid film');let end=0;
 for(let i=0;i<f.samples.length;i++){const s=f.samples[i];if(s.index!==i||s.time_s!==end||!Number.isFinite(s.end_s)||s.end_s<=end||s.end_s>f.duration_s||!Array.isArray(s.rgb)||s.rgb.length!==3||s.rgb.some(x=>!Number.isInteger(x)||x<0||x>255)||!/^objects\/[a-f0-9]{2}\/[a-f0-9]{64}\.webp$/.test(s.image))throw Error('Invalid sample');end=s.end_s;s.image=AtlasDeployment.asset(s.image);}
 if(end!==f.duration_s)throw Error('Incomplete timeline');if(f.poster)f.poster=AtlasDeployment.asset(f.poster);window.films=[f];
 const s=document.createElement('script');s.src=AtlasDeployment.site('local-gallery.js');s.onload=()=>{document.querySelector('main').hidden=false;status.hidden=true;};s.onerror=fail;document.body.append(s);
}catch(e){fail();}})();
