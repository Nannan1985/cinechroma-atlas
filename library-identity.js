/* Shared display identity, confirmed by the creator. Never changes account or commit identity. */
(function(root){
 'use strict';
 const config=Object.freeze({creatorDisplayName:"Nannan Vis",creatorNameConfirmed:true});
 function displayName(locale='zh'){return config.creatorDisplayName||(locale==='en'?'Creator':'作者');}
 function apply(node){if(!node?.querySelectorAll)return;for(const el of node.querySelectorAll('[data-creator-name]'))el.textContent=displayName(root.LibraryI18n?.locale);}
 function assertPublishable(){if(!config.creatorNameConfirmed||!config.creatorDisplayName?.trim())throw new Error('Creator display name must be confirmed before publishing.');return true;}
 const api={...config,displayName,apply,assertPublishable};
 if(typeof module!=='undefined')module.exports=api;else root.LibraryIdentity=api;
})(globalThis);
