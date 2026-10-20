/* Mobile inspector state is local presentation only; sampling and graph data are untouched. */
(function(root){
 'use strict';
 const body=document.body,panel=document.getElementById('filmDetails'),toggle=document.getElementById('mobileSheetToggle'),phone=matchMedia('(max-width:740px)');
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
