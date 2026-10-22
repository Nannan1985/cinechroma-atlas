/* Bilingual adapter for the standalone published film viewer. The atlas iframe
   remains owned by its parent and never requests a second collection index. */
(function(root){
'use strict';
const copy={
 '返回星图':'Back to atlas','语言':'Language','中文':'Chinese','英文':'English',
 '正在读取影片 / Loading film…':'Loading film…','正在读取影片色彩。':'Loading film colors.',
 '影片暂不可用，请返回星图重试。':'This film could not be loaded. Return to the atlas to retry.',
 '影色星图 / Cinechroma Atlas':'Cinechroma Atlas','影片':'Film','色彩星图':'Color atlas',
 'CINECHROMA ATLAS':'Cinechroma Atlas','ABOUT THE FILM':'About the film',
 'THROUGH TIME / 时间剖面':'Through time','电影的颜色，静候展开':'A film, ready to unfold',
 '动态 开':'Motion on','动态 关':'Motion off','关闭氛围动态':'Turn motion off','开启氛围动态':'Turn motion on',
 '展开影片':'Open film','缩回星图':'Collapse ring','重新演示从节点到色环的展开':'Replay the unfolding color ring','重看展开':'Replay unfolding',
 '影片图库。方向键切换影片，Enter 展开，Escape 返回。':'Film viewer. Enter opens the film; Escape collapses the ring.',
 '按真实时间分布的跨时段颜色候选':'Color echoes positioned by their film timestamps',
 '当前真实采样画面':'Current sampled frame','编辑排布 · 保留节点位置':'Single-film view · Position has no similarity meaning',
 '悬浮选帧 · ← → 浏览 · Esc 返回':'Hover to locate · Arrow keys to browse · Esc to collapse',
 '电影海报':'Film poster','按影片时间排列的辅助曲线':'Color curves in film time',
 '当前预览':'Current preview','固定参照':'Pinned frame','始终按时间':'Chronological order',
 '亮度代理':'Brightness proxy','加权编码 RGB':'Weighted encoded RGB','亮度代理时间曲线':'Brightness proxy over time',
 '相邻采样色差':'Adjacent color change','平均 RGB 欧氏距离':'Mean RGB Euclidean distance',
 '相邻采样平均色差时间曲线':'Adjacent mean-color difference over time',
 '悬浮或 ← → 按时间预览 · Enter 固定参照 · 首个采样没有前序色差':'Hover or use arrow keys to locate a moment · Enter pins the frame · The first sample has no previous color',
 '素材来源与许可':'About these samples','采样与色彩说明':'About these samples',
 '色点正在舒展为色环… 展开后可选帧。':'Unfolding the color ring… Choose a frame when it is ready.',
 '色环正在收回光点…':'Collapsing the color ring…',
 '悬浮预览 · 点击色环或小圆图固定参照 · 点击环外返回星图':'Hover to locate · Choose the ring or an echo to pin a frame · Click outside to collapse',
 '单片色彩节点。按回车键展开。':'A single-film color node. Press Enter to unfold.',
 '星图中的环形时间色带':'A film’s color timeline',
 '动态已开启 · 星点缓缓漂移，展开与收回平滑过渡':'Motion on · Gentle drift and smooth unfolding',
 '已遵循系统「减少动态」设置；仍可点「动态 关」主动开启。':'Your reduced-motion preference is active. You can enable motion with the Motion off button.',
 '动态已暂停 · 色彩与位置保持静止':'Motion paused · Colors and positions stay still',
 '电影色彩 · 时间采样':'Film colors · Samples through time',
 '节点为编辑排布 · 无相似度含义':'Single-film view · Position has no similarity meaning',
 '合成数据 · 非真实长片':'Synthetic test data · Not a feature film',
 '测试夹具 · 非真实长片':'Synthetic test data · Not a feature film',
 '影片色彩':'Film colors','上一个时间采样':'Previous time sample','下一个时间采样':'Next time sample',
 '色彩回声 · 开':'Color echoes on','色彩回声 · 关':'Color echoes off',
 '查看完整画幅':'View full frame','圆形裁切':'Circular crop',
 '已选画面':'Selected frame','画面暂不可用':'Frame unavailable','该采样画面暂时无法加载':'This frame could not be loaded',
 '这个参照没有符合条件的跨时段颜色候选。':'No color echoes match this reference outside the excluded interval.',
 '影片资料与译名来源说明见星图资料栏。':'Metadata and translation sources are described in the atlas.',
 '请启用 JavaScript。数据与画面随页面提供。':'Enable JavaScript to load film data and frames.'
};
const zhCopy={'CINECHROMA ATLAS':'影色星图','ABOUT THE FILM':'影片资料','THROUGH TIME / 时间剖面':'时间剖面','正在读取影片 / Loading film…':'正在读取影片…','缩回星图':'收起色环','素材来源与许可':'采样与色彩说明','节点为编辑排布 · 无相似度含义':'单片视图 · 位置不表示相似度','影色星图 / Cinechroma Atlas':'返回星图',
 '悬浮预览 · 点击色环或小圆图固定参照 · 点击环外返回星图':'悬浮定位 · 点击色环或小圆图固定参照 · 点击环外收起色环',
 '影片图库。方向键切换影片，Enter 展开，Escape 返回。':'单片色彩视图。回车键展开影片，退出键收起色环。',
 '悬浮选帧 · ← → 浏览 · Esc 返回':'悬浮定位 · 方向键浏览 · 退出键收起色环',
 '悬浮或 ← → 按时间预览 · Enter 固定参照 · 首个采样没有前序色差':'悬浮或方向键按时间定位 · 回车键固定参照 · 首个采样没有前序色差'};
const chineseFragments=[
 ['Enter 或空格固定参照，方向键选帧，Home/End 到首尾，Escape 返回。','回车键或空格键固定参照，方向键选帧，起始键和结束键跳至首尾，退出键收起色环。'],
 ['方向键切换影片，Enter 或空格展开。','回车键或空格键展开影片。'],
 ['图库选中 ','当前影片：']
];
const englishFragments=[
 ['Enter 或空格固定参照，方向键选帧，Home/End 到首尾，Escape 返回。','Enter or Space pins the frame; arrow keys choose samples; Home/End go to the ends; Escape collapses the ring.'],
 ['方向键切换影片，Enter 或空格展开。','Enter or Space opens the film.'],
 ['时间始终顺时针，不重排。','Time always runs clockwise. '],
 ['排除前后 120 秒（含边界）','Excludes 120 seconds on either side, including the boundaries'],
 ['每个候选时段选一帧，最多 10 帧。当前 ','One frame per candidate interval, up to 10. Current: '],
 ['悬浮预览不会改变参照。','Hovering does not change the pinned frame.'],
 ['首个采样，没有前序色差','First sample; no previous color difference'],
 ['始终按时间顺序。','Always in chronological order.'],
 ['相邻采样平均 RGB 距离 ','Adjacent mean RGB distance '],
 ['范围 0 到 1','range 0 to 1'],['个跨时段颜色候选','color echoes across the timeline'],
 ['参照已固定为 ','Reference pinned at '],['的真实采样画面','sampled frame'],
 ['，点击固定为参照',', click to pin the frame'],['图库选中 ','Selected film: '],
 ['顺时针 · 时间固定','Clockwise · Fixed timeline'],['顺时针 · ','Clockwise · '],
 [' 个真实采样',' samples'],['12° 缺口','12° gap'],[' 个样本',' samples'],
 ['正在加载 ','Loading '],['亮度代理 ','Brightness proxy '],['当前预览 · ','Current preview · '],
 ['影片色彩 · ','Film colors · '],[' · 固定参照',' · Pinned frame'],['固定参照 ','Pinned frame '],[' 固定参照',' Pinned frame'],[' · 参照 ',' · Reference '],
 ['，平均色 ', ', mean color '],['平均色 ','mean color '],['，样本 ', ', sample '],
 [' · 时段 ',' · Interval '],['— 首帧','— First sample'],[' 帧。',' frames.'],[' 海报',' poster'],
 ['，',', '],['。','. ']
];
function standalone(){try{return root.parent===root;}catch(_){return false;}}
function locale(){return root.LibraryI18n?.locale==='en'?'en':'zh';}
let movie=null,metadata=null,original=null,indexFailed=false;
function titleFor(lang=locale()){if(!movie)return '';const titles=metadata?.metadata_v2?.title;return titles?.[lang]||(lang==='en'?(titles?.original||metadata?.original_title):null)||metadata?.title||original?.title||movie.title||'';}
function translated(text,lang=locale()){
 text=String(text??'');const trimmed=text.trim();
 if(lang==='zh'){const names=[...new Set([original?.title,metadata?.title,metadata?.original_title,...Object.values(metadata?.metadata_v2?.title||{})].filter(Boolean))].sort((a,b)=>b.length-a.length);let value=text;for(const name of names)value=value.split(name).join('\u0001FILM\u0001');value=value.replace(value.trim(),zhCopy[value.trim()]||value.trim());for(const [from,to]of chineseFragments)value=value.split(from).join(to);return value.split('\u0001FILM\u0001').join(titleFor(lang));}
 if(copy[trimmed])return text.replace(trimmed,copy[trimmed]);
 // Titles are data, not generic UI phrases. Protect them before translating UI
 // fragments so a film whose title contains e.g. “影片” is never rewritten.
 const names=[...new Set([original?.title,metadata?.title,metadata?.original_title,...Object.values(metadata?.metadata_v2?.title||{})].filter(Boolean))].sort((a,b)=>b.length-a.length);
 let result=text;for(const name of names)result=result.split(name).join('\u0001FILM\u0001');
 for(const [from,to]of englishFragments)result=result.split(from).join(to);
 return result.split('\u0001FILM\u0001').join(titleFor(lang));
}
function localizedMeta(record,fallback={},lang=locale()){
 const labels=field=>record?.metadata_v2?.[field]?.map(e=>e.labels?.[lang]||e.original||e.labels?.en||e.labels?.zh).filter(Boolean)??record?.[field]??fallback[field]??[];
 const titles=record?.metadata_v2?.title;
 return {title:titles?.[lang]||(lang==='en'?(titles?.original||record?.original_title):null)||record?.title||fallback.title||'',year:record?.year||fallback.year,genres:labels('genres'),countries:labels('countries'),directors:labels('directors')};
}
function format(seconds){const t=Math.max(0,Math.floor(seconds||0)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
const saved=new WeakMap();
function rewrite(node,key,raw,set){const prior=saved.get(node)||{},entry=prior[key],source=entry&&raw===entry.rendered?entry.raw:raw,next=translated(source);prior[key]={raw:source,rendered:next};saved.set(node,prior);if(next!==raw)set(next);}
function apply(){
 if(!active||!root.document?.body)return;const doc=root.document;
 const walk=doc.createTreeWalker(doc.body,4);let node;while(node=walk.nextNode()){if(['SCRIPT','STYLE','NOSCRIPT'].includes(node.parentElement?.tagName)||node.parentElement?.closest?.('[data-film-copy]'))continue;rewrite(node,'text',node.textContent,v=>{node.textContent=v;});}
 for(const el of doc.body.querySelectorAll('[aria-label],[aria-valuetext],[title],[alt]'))for(const attr of ['aria-label','aria-valuetext','title','alt']){const raw=el.getAttribute(attr);if(raw!==null)rewrite(el,attr,raw,v=>el.setAttribute(attr,v));}
 doc.documentElement.lang=locale()==='en'?'en':'zh-CN';
 doc.title=movie?titleFor()+' — '+(locale()==='en'?'Cinechroma Atlas':'影色星图'):(locale()==='en'?'Cinechroma Atlas — Film colors':'影色星图 — 影片色彩');
 const select=doc.getElementById('filmLanguage');if(select&&select.value!==locale())select.value=locale();
 const creator=root.LibraryIdentity?.displayName?.(locale());if(creator)for(const el of doc.body.querySelectorAll('[data-creator-name]'))if(el.textContent!==creator)el.textContent=creator;
}
function setText(id,value){const el=root.document?.getElementById(id);if(el&&el.textContent!==value)el.textContent=value;}
function updateInfo(film=movie){
 if(!active||!film)return;const en=locale()==='en',meta=localizedMeta(metadata,original?.metadata||{}),doc=root.document;
 movie.title=meta.title||titleFor();movie.metadata=meta;
 const fields=[[en?'Year':'年份',meta.year],[en?'Genres':'类型',meta.genres.join(' / ')],[en?'Production countries':'制片地区',meta.countries.join(' / ')],[en?'Directors':'导演',meta.directors.join(' / ')]];
 setText('filmInfo',[movie.title,...fields.filter(([,v])=>v).map(([key,value])=>key+(en?': ':'：')+value)].join('\n'));
 const source=metadata?.metadata_provenance?.source;
 setText('metadataSource',indexFailed?(en?'Bilingual metadata is unavailable. Original metadata is retained; return to the atlas to retry.':'双语资料暂不可用，保留原始资料；可返回星图重试。'):source==='TMDB'?(en?'Metadata uses matched TMDB records and confirmed display names from this collection. Years refer to release dates; regions are production countries.':'资料采用本片集中已匹配的 TMDB 记录及已确认的显示名；年份按首映日期，地区为制片地区。'):(en?'Metadata comes from this collection, with confirmed display names where available. The color timeline uses the measured movie duration.':'资料来自本片集，使用已有的确认显示名；色彩时间轴以影片实测时长为准。'));
 const start=format(film.source_start_s),duration=format(film.source_duration_s||film.duration_s);
 setText('filmNotes',en?'This sampled window starts at '+start+' in a source of '+duration+'. Colors are arithmetic means of gamma-encoded RGB across resized full frames, including black bars and burned-in text. They are not dominant colors or linear-light averages. Similar colors do not imply similar scenes. Frames load on demand.':'本次采样从原片 '+start+' 开始，原片实测时长 '+duration+'。颜色为缩放后整幅画面的编码 RGB 算术平均，黑边与烧录文字参与计算；不是主色提取或线性光平均。相近颜色不代表内容相似。截图按需读取。');
 const poster=doc?.getElementById('filmPoster');if(poster)poster.alt=movie.title+(en?' poster':' 海报');
 apply();
}
let indexPromise=null;
async function prepare(film){
 if(!active)return film;movie=film;original={title:film.title,metadata:film.metadata||{}};
 try{indexPromise??=root.AtlasDeployment.index();const data=await indexPromise;metadata=data.films.find(f=>f.export_id===film.id)||null;indexFailed=!metadata;}catch(_){indexFailed=true;}
 const meta=localizedMeta(metadata,original.metadata);film.title=meta.title||titleFor();film.metadata=meta;if(metadata?.poster)film.poster=metadata.poster;return film;
}
function refresh(){if(!active)return;root.LibraryI18n?.syncDocument?.();updateInfo();root.FilmGallery?.refreshLanguage?.();apply();}
function start(){if(!active)return;root.document.getElementById('filmLanguage')?.addEventListener('change',e=>{root.LibraryI18n?.setLocale(e.target.value);refresh();});
 for(const id of ['filmInfo','metadataSource','filmNotes'])root.document.getElementById(id)?.setAttribute('data-film-copy','true');
 const observer=new root.MutationObserver(apply);observer.observe(root.document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','aria-valuetext','title','alt']});apply();
}
const active=typeof module==='undefined'&&standalone();
const api={active,prepare,apply,updateInfo,refresh,translated,localizedMeta,format,canvasText:text=>active?translated(text):text};
if(typeof module!=='undefined')module.exports=api;else{root.LibraryFilmI18n=api;start();}
})(globalThis);
