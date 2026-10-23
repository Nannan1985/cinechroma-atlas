/* Mobile inspector state is local presentation only; sampling and graph data are untouched. */
(function(root){
 'use strict';
 const body=document.body,panel=document.getElementById('filmDetails'),toggle=document.getElementById('mobileSheetToggle'),phone=matchMedia('(max-width:740px)');
 const identity=document.createElement('span'),name=document.createElement('span'),hint=toggle.querySelector('span');
 identity.className='mobile-film-identity';name.className='mobile-film-name';
 identity.append(name,hint);toggle.append(identity);
 const title=document.getElementById('filmTitle'),year=document.getElementById('filmYear');
 function syncIdentity(){const text=[title.textContent,year.textContent.split(' · ')[0]].filter(Boolean).join(' · ');if(name.textContent!==text)name.textContent=text;}
 const identityObserver=new MutationObserver(syncIdentity);
 for(const el of [title,year])identityObserver.observe(el,{childList:true,subtree:true,characterData:true});
 syncIdentity();
 function setPanel(open){if(body.classList.contains('sheet-open')!==!!open)body.classList.toggle('sheet-open',!!open);if(toggle.getAttribute('aria-expanded')!==String(!!open))toggle.setAttribute('aria-expanded',String(!!open));}
 toggle.onclick=()=>setPanel(!body.classList.contains('sheet-open'));
 document.getElementById('seriesList').addEventListener('click',e=>{if(phone.matches&&e.target.closest('button'))setPanel(false);});
 new MutationObserver(()=>{if(!body.classList.contains('film-open'))setPanel(false);}).observe(body,{attributes:true,attributeFilter:['class']});
 phone.addEventListener('change',()=>{if(!phone.matches)setPanel(false);});
 root.LibraryResponsive={setPanel,presentTour(step){if(phone.matches)setPanel(['info','series','directors','charts'].includes(step));},scrollTarget(target){
  if(!phone.matches||!target||!panel.contains(target))return;
  const r=target.getBoundingClientRect(),p=panel.getBoundingClientRect();panel.scrollTo({top:panel.scrollTop+r.top-p.top-8,behavior:'instant'});
 }};
})(window);
