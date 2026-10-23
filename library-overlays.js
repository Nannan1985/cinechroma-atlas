/* Footer disclosures keep native keyboard semantics; only their content fades. */
(()=>{
 const panels=[...document.querySelectorAll('.catalog,.collection-about,.creator-credit')];
 const animations=new Map();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-reduced');
 function show(panel,open){
  animations.get(panel)?.cancel();animations.delete(panel);
  const content=panel.querySelector(':scope > div');
  if(open){panels.filter(p=>p!==panel).forEach(p=>show(p,false));panel.open=true;}
  if(!panel.open)return;
  if(!content?.animate||reduced()){panel.open=open;return;}
  const frames=[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}];
  const animation=content.animate(open?frames:frames.slice().reverse(),{duration:open?180:140,easing:'ease-out',fill:'both'});
  animations.set(panel,animation);
  animation.onfinish=()=>{if(animations.get(panel)!==animation)return;if(!open)panel.open=false;animation.cancel();animations.delete(panel);};
 }
 panels.forEach(panel=>panel.querySelector('summary').addEventListener('click',event=>{event.preventDefault();show(panel,!panel.open);}));
 document.addEventListener('pointerdown',event=>{panels.forEach(panel=>{if(panel.open&&!panel.contains(event.target))show(panel,false);});},true);
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;panels.forEach(panel=>{if(panel.open){if(panel.contains(document.activeElement))panel.querySelector('summary').focus();show(panel,false);}});});
 // Pointer events inside the same-origin film iframe do not bubble to the parent.
 window.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement?.tagName==='IFRAME')panels.forEach(p=>show(p,false));},0);});
})();
